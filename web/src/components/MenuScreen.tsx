import { useReducer } from 'react';
import { SKINS, buySkin, gemBalance, getSelectedSkin, isSkinUnlocked, selectSkin } from 'game';
import type { SkinDef } from 'game';

interface MenuScreenProps {
  onPlay: () => void;
  onRanking: () => void;
}

// Menu principal da PLATAFORMA (Polity Games) — vive no React, nunca em
// Scene Phaser (D-07). Cada jogo futuro da plataforma vira um card aqui (RF-01).
export function MenuScreen({ onPlay, onRanking }: MenuScreenProps) {
  // estado das skins vive no pacote 'game' (localStorage) — o reducer só
  // força re-render após selecionar/comprar
  const [, refresh] = useReducer((x: number) => x + 1, 0);

  const handleSkinTap = (skin: SkinDef): void => {
    if (isSkinUnlocked(skin)) {
      selectSkin(skin.id);
    } else if (skin.unlock.type === 'gems' && buySkin(skin.id)) {
      selectSkin(skin.id); // comprou → já equipa
    }
    refresh();
  };

  const selectedId = getSelectedSkin().id;

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

          {/* Skins (T07B-04, D-11): desbloqueio por conquista ou propinas
              (D-21). A dourada é o "sink" da economia — motivo pra caçar 💵. */}
          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Personagem <span className="float-right normal-case">💵 {gemBalance()}</span>
            </p>
            <div className="mt-3 flex justify-between gap-2">
              {SKINS.map((skin) => {
                const unlocked = isSkinUnlocked(skin);
                const selected = skin.id === selectedId;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => handleSkinTap(skin)}
                    aria-label={`Skin ${skin.label} — ${unlocked ? 'disponível' : skin.requirement}`}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition active:scale-95 ${
                      selected ? 'bg-slate-700 ring-2 ring-green-400' : 'hover:bg-slate-700/60'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-8 items-center justify-center rounded ${
                        unlocked ? '' : 'opacity-40'
                      }`}
                      style={{ backgroundColor: skin.css }}
                    >
                      {!unlocked && <span aria-hidden>🔒</span>}
                    </span>
                    <span className="text-[10px] leading-tight text-slate-400">
                      {unlocked ? skin.label : skin.requirement}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
