interface MenuScreenProps {
  onPlay: () => void;
  onRanking: () => void;
}

// Menu principal da PLATAFORMA (Polity Games) — vive no React, nunca em
// Scene Phaser (D-07). Cada jogo futuro da plataforma vira um card aqui (RF-01).
export function MenuScreen({ onPlay, onRanking }: MenuScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-900 p-6 text-white">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Polity Games</h1>
        <p className="mt-2 text-slate-400">Jogos rápidos. Sátira leve.</p>
      </header>

      <section aria-label="Jogos disponíveis" className="w-full max-w-sm">
        <article className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h2 className="text-2xl font-semibold">Polity Bros</h2>
          <p className="mt-1 text-sm text-slate-400">
            Corra pelo Brasil, desvie dos escândalos e colete votos.
          </p>
          <button
            type="button"
            onClick={onPlay}
            className="mt-6 w-full rounded-xl bg-green-500 py-4 text-lg font-bold text-slate-900 transition hover:bg-green-400 active:scale-95"
          >
            Jogar
          </button>
          <button
            type="button"
            onClick={onRanking}
            className="mt-3 w-full rounded-xl border border-slate-600 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95"
          >
            Ver ranking
          </button>
        </article>
      </section>
    </main>
  );
}
