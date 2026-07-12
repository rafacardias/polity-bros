import { useEffect, useRef, useState } from 'react';
import type { GameEventPayload } from 'game';
import type { RankingContext, RankingEntry } from '../lib/ranking';
import { fetchOwnProfile } from '../lib/profile';
import { composeShareImage, shareScoreImage } from '../lib/shareImage';

interface SocialSpotlightProps {
  payload: GameEventPayload;
  context: RankingContext;
  ownPlayerId: string | null;
}

const VISIBLE_MS = 3200;

type PillState = 'idle' | 'loading' | 'saved';

// T07D-03/D-15: bottom sheet que aparece por cima do canvas logo após o
// gameover — mostra onde o jogador ficou (position) e dois Top 7 (global e
// pessoal), depois se recolhe sozinho. pointer-events-none em TUDO: o toque
// tem que atravessar pro Phaser (RN-03), o "jogar de novo" não pode esperar.
//
// T07D-04/D-12: o pill de share é uma ilha pointer-events-auto que sobrevive
// ao recolhimento do sheet — o componente inteiro só desmonta quando o App
// descarta o spotlight por invalidação (reinício ou saída pro menu), nunca
// por um timer interno.
export function SocialSpotlight({ payload, context, ownPlayerId }: SocialSpotlightProps) {
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [pillState, setPillState] = useState<PillState>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dois frames de raf pra garantir que o navegador pinte o estado "fora da
  // tela" antes de animar pra dentro — senão o slide-up não roda (CSS transition
  // exige um frame com o estado inicial já commitado no DOM).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const showTimer = setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => clearTimeout(showTimer);
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

  async function handleShare(): Promise<void> {
    if (pillState === 'loading') return;
    setPillState('loading');

    const blob = await composeShareImage(payload, username);
    if (!blob) {
      setPillState('idle');
      return;
    }

    const result = await shareScoreImage(blob, payload.score);
    if (result === 'downloaded') {
      setPillState('saved');
      savedTimerRef.current = setTimeout(() => setPillState('idle'), 2000);
    } else {
      setPillState('idle');
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
          <RankingColumn title="🌎 TOP 7" entries={context.topGlobal} ownPlayerId={ownPlayerId} />
          <PersonalColumn title="📈 SEUS TOP 7" entries={context.topPersonal} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={pillState === 'loading'}
        className="pointer-events-auto absolute bottom-5 right-4 z-30 rounded-full bg-emerald-500 px-4 py-2 font-mono text-xs font-bold text-slate-950 shadow-lg transition-opacity disabled:opacity-70"
      >
        {pillState === 'loading' ? '…' : pillState === 'saved' ? 'salvo! ✓' : '📤 Compartilhar'}
      </button>
    </div>
  );
}

function RankingColumn({
  title,
  entries,
  ownPlayerId,
}: {
  title: string;
  entries: RankingEntry[];
  ownPlayerId: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <ol className="flex flex-col gap-0.5 font-mono">
        {entries.length === 0 && <li className="text-slate-500">—</li>}
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

function PersonalColumn({ title, entries }: { title: string; entries: RankingEntry[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <ol className="flex flex-col gap-0.5 font-mono">
        {entries.length === 0 && <li className="text-slate-500">—</li>}
        {entries.map((entry, i) => (
          <li key={`${entry.created_at}-${i}`} className="flex items-center justify-between gap-1">
            <span className="shrink-0 font-bold">{entry.score}</span>
            <span className="truncate text-slate-400">{(entry.world ?? 'sp').toUpperCase()}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
