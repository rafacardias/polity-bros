import { useEffect, useState } from 'react';
import type { GameEventPayload } from 'game';
import type { RankingContext, RankingEntry } from '../lib/ranking';

interface SocialSpotlightProps {
  payload: GameEventPayload;
  context: RankingContext;
  ownPlayerId: string | null;
  onDone: () => void;
}

const VISIBLE_MS = 3200;
const EXIT_MS = 400;

// T07D-03/D-15: bottom sheet que aparece por cima do canvas logo após o
// gameover — mostra onde o jogador ficou (position) e dois Top 7 (global e
// pessoal), depois se recolhe sozinho. pointer-events-none em TUDO: o toque
// tem que atravessar pro Phaser (RN-03), o "jogar de novo" não pode esperar.
export function SocialSpotlight({ payload, context, ownPlayerId, onDone }: SocialSpotlightProps) {
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);

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

  useEffect(() => {
    if (!leaving) return;
    const hideTimer = setTimeout(onDone, EXIT_MS);
    return () => clearTimeout(hideTimer);
  }, [leaving, onDone]);

  const hidden = entering || leaving;

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
