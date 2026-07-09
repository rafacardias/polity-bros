import { useEffect, useState } from 'react';
import { fetchTopScores, type RankingEntry } from '../lib/ranking';

interface RankingScreenProps {
  onBack: () => void;
}

// RF-13: Top 10 (leitura pública), sem identificação de jogador — MVP não
// tem nicknames (D-06, backlog v2).
export function RankingScreen({ onBack }: RankingScreenProps) {
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);

  useEffect(() => {
    fetchTopScores().then(setEntries);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-slate-900 p-6 text-white">
      <header className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium"
        >
          ← Menu
        </button>
      </header>

      <ol className="w-full max-w-sm space-y-2">
        {entries === null && <p className="text-center text-slate-400">Carregando…</p>}
        {entries?.length === 0 && (
          <p className="text-center text-slate-400">Ninguém pontuou ainda. Seja o primeiro!</p>
        )}
        {entries?.map((entry, i) => (
          <li
            key={`${entry.created_at}-${i}`}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <span className="w-8 font-mono text-slate-400">#{i + 1}</span>
            <span className="font-bold">{entry.score} pts</span>
            <span className="text-sm text-slate-400">
              {entry.votes} votos · {entry.distance}m
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
