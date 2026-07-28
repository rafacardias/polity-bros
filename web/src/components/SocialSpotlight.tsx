import { useEffect, useRef, useState } from 'react';
import { getLastScreenshot, worldLabel } from 'game';
import type { GameEventPayload } from 'game';
import type { RankingContext, RankingEntry } from '../lib/ranking';
import { fetchOwnProfile } from '../lib/profile';
import { composeShareImage, shareScoreImage } from '../lib/shareImage';

interface SocialSpotlightProps {
  payload: GameEventPayload;
  context: RankingContext;
  loading: boolean;
  ownPlayerId: string | null;
}

const VISIBLE_MS = 3200;
// Teto de segurança: se o ranking nunca chegar (rede caída), o sheet recolhe
// assim mesmo em vez de ficar preso na tela cobrindo o jogo.
const MAX_VISIBLE_MS = 9000;

type PillState = 'idle' | 'loading' | 'saved' | 'error';

// T07D-03/D-15: bottom sheet que aparece por cima do canvas logo após o
// gameover — mostra onde o jogador ficou (position) e dois Top 7 (global e
// pessoal), depois se recolhe sozinho. pointer-events-none em TUDO: o toque
// tem que atravessar pro Phaser (RN-03), o "jogar de novo" não pode esperar.
//
// T07D-04/D-12: o pill de share é uma ilha pointer-events-auto que sobrevive
// ao recolhimento do sheet — o componente inteiro só desmonta quando o App
// descarta o spotlight por invalidação (reinício ou saída pro menu), nunca
// por um timer interno.
export function SocialSpotlight({
  payload,
  context,
  loading,
  ownPlayerId,
}: SocialSpotlightProps) {
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [pillState, setPillState] = useState<PillState>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // guarda de reentrância própria: derivar de pillState não bastava, porque o
  // estado sai de 'loading' assim que um flash começa, mesmo com share em voo
  const sharingRef = useRef(false);

  // dois frames de raf pra garantir que o navegador pinte o estado "fora da
  // tela" antes de animar pra dentro — senão o slide-up não roda (CSS transition
  // exige um frame com o estado inicial já commitado no DOM).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, []);

  // O sheet agora monta ANTES do ranking chegar (para o botão de compartilhar
  // existir desde o 1º frame — RF-16). Se o relógio começasse na montagem, o
  // ranking apareceria só nos segundos finais e o spotlight social do D-15
  // perderia o efeito. Por isso os VISIBLE_MS contam a partir da CHEGADA dos
  // dados; o MAX_VISIBLE_MS garante o recolhimento mesmo se eles não vierem.
  useEffect(() => {
    if (loading) return;
    const showTimer = setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => clearTimeout(showTimer);
  }, [loading]);

  useEffect(() => {
    const capTimer = setTimeout(() => setLeaving(true), MAX_VISIBLE_MS);
    return () => clearTimeout(capTimer);
  }, []);

  // busca o username uma vez, best-effort — sem ele a imagem só sai sem a
  // linha "por @...". Não bloqueia nada nem repete a busca em re-renders.
  useEffect(() => {
    fetchOwnProfile()
      .then((profile) => setUsername(profile?.username ?? null))
      .catch(() => setUsername(null));
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const hidden = entering || leaving;

  function flashPill(state: PillState): void {
    setPillState(state);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setPillState('idle'), 2000);
  }

  async function handleShare(): Promise<void> {
    if (sharingRef.current) return;
    sharingRef.current = true;
    // mata o timer de um flash anterior: sem isto ele dispararia no meio deste
    // share, devolvendo o pill a 'idle' com a operação ainda em voo — o botão
    // reabilitava e um segundo navigator.share() concorrente rejeitava com
    // InvalidStateError, acusando "falhou" num compartilhamento que deu certo.
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setPillState('loading');

    // payload.screenshot vem undefined quando a morte emitiu o gameover no
    // mesmo tick da captura (o snapshot do Phaser é assíncrono). Como o clique
    // acontece segundos depois, o frame já resolveu e está disponível aqui.
    const screenshot = payload.screenshot ?? getLastScreenshot();
    try {
      const blob = await composeShareImage({ ...payload, screenshot }, username);
      if (!blob) {
        flashPill('error'); // antes voltava mudo pra 'idle' — indistinguível de "nada aconteceu"
        return;
      }

      const result = await shareScoreImage(blob, payload.score);
      if (result === 'downloaded') flashPill('saved');
      else if (result === 'failed') flashPill('error');
      // 'shared' (o share sheet nativo já é o feedback) e 'cancelled' (o jogador
      // desistiu de propósito — acusar erro seria injusto) voltam calados.
      else setPillState('idle');
    } finally {
      sharingRef.current = false;
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center">
      <div
        className={`pointer-events-none w-full max-w-sm rounded-t-2xl border-t border-slate-700 bg-slate-900/90 px-4 pb-6 pt-4 text-white shadow-2xl transition-all duration-300 ease-out ${
          hidden ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <p className="mb-3 text-center font-mono text-sm font-bold tracking-wide">
          VOCÊ{context.position !== null ? ` · #${context.position}` : ''} · {payload.score} pts
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <RankingColumn
            title="🌎 TOP 7"
            entries={context.topGlobal}
            ownPlayerId={ownPlayerId}
            loading={loading}
          />
          <PersonalColumn title="📈 SEUS TOP 7" entries={context.topPersonal} loading={loading} />
        </div>
      </div>
      <button
        type="button"
        // seletor estável para o E2E: o rótulo muda com o estado (Compartilhar
        // → … → salvo! ✓ → falhou), então localizar pelo texto perderia o
        // botão exatamente no instante que o teste quer observar
        data-testid="share-pill"
        onClick={() => void handleShare()}
        disabled={pillState === 'loading'}
        className="pointer-events-auto absolute bottom-5 right-4 z-30 rounded-full bg-emerald-500 px-4 py-2 font-mono text-xs font-bold text-slate-950 shadow-lg transition-opacity disabled:opacity-70"
      >
        {pillState === 'loading'
          ? '…'
          : pillState === 'saved'
            ? 'salvo! ✓'
            : pillState === 'error'
              ? 'falhou — tentar de novo'
              : '📤 Compartilhar'}
      </button>
    </div>
  );
}

function RankingColumn({
  title,
  entries,
  ownPlayerId,
  loading,
}: {
  title: string;
  entries: RankingEntry[];
  ownPlayerId: string | null;
  loading: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <ol className="flex flex-col gap-0.5 font-mono">
        {entries.length === 0 && <li className="text-slate-500">{loading ? '…' : '—'}</li>}
        {entries.map((entry, i) => (
          <li
            key={`${entry.created_at}-${i}`}
            className={`flex items-center justify-between gap-1 truncate rounded px-1 ${
              entry.player_id === ownPlayerId ? 'bg-emerald-900/60 text-emerald-300' : ''
            }`}
          >
            <span className="truncate">
              {entry.username ?? <span className="italic text-slate-500">Anônimo</span>}
            </span>
            <span className="shrink-0 font-bold">{entry.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PersonalColumn({
  title,
  entries,
  loading,
}: {
  title: string;
  entries: RankingEntry[];
  loading: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <ol className="flex flex-col gap-0.5 font-mono">
        {entries.length === 0 && <li className="text-slate-500">{loading ? '…' : '—'}</li>}
        {entries.map((entry, i) => (
          <li key={`${entry.created_at}-${i}`} className="flex items-center justify-between gap-1">
            <span className="shrink-0 font-bold">{entry.score}</span>
            <span className="truncate text-slate-400">{worldLabel(entry.world ?? 'sp')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
