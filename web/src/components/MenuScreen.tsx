import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  ECONOMY,
  SKINS,
  WORLDS,
  WorldSystem,
  gemBalance,
  getSelectedSkin,
  isSkinUnlocked,
  selectSkin,
} from 'game';
import type { SkinDef } from 'game';

// Miniatura da skin no menu (Fase 4): skin = PERSONAGEM, então mostramos o
// sprite idle real (servido em /assets/sprites/<char>.png — o web/public/assets
// é symlink pro game/public/assets). Skins "em breve" (sem char) viram um
// cadeado. image-rendering pixelated mantém o pixel-art nítido no upscale.
function SkinThumb({ skin, big }: { skin: SkinDef; big?: boolean }) {
  const box = big ? 'h-24 w-16' : 'h-12 w-9';
  if (!skin.char) {
    return (
      <span
        className={`flex ${box} items-center justify-center rounded-lg bg-slate-700 text-slate-500`}
      >
        {big ? '🔒' : '🔒'}
      </span>
    );
  }
  return (
    <span className={`flex ${box} items-end justify-center`}>
      <img
        src={`/assets/sprites/${skin.char}.png`}
        alt={skin.label}
        className="max-h-full w-auto"
        style={{ imageRendering: 'pixelated' }}
      />
    </span>
  );
}

// Indicador de swipe da galeria (D-33): com 7 skins de ~72px numa caixa de
// ~310px, ~2 cards ficam escondidos e NADA dizia que a fileira rola — o dono
// pediu um ">" para deixar isso óbvio.
//
// Chevron + fade na borda em vez de setas clicáveis: setas por cima dos cards
// roubariam área de toque num layout já apertado, e o alvo é comunicar o
// gesto, não substituí-lo. Cada indicador só existe se houver conteúdo naquele
// lado — um chevron que não leva a nada é pior que nenhum.
//
// O `-mx-1` MIGROU da fileira para este wrapper. Ele é o bleed que impede o
// `ring-2` do card selecionado de ser cortado, e os overlays precisam se ancorar
// nas bordas REAIS da fileira; o painel pai não é `relative`.
function SkinRail({ children }: { children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback((): void => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // tolerância de 4px: subpixel de zoom/DPR deixaria o chevron da direita
    // aceso para sempre ao chegar no fim do scroll
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    measure(); // no mount o painel já está montado e os cards têm largura fixa
    window.addEventListener('resize', measure); // rotação de celular/tablet
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div className="relative -mx-1">
      <div
        ref={rail}
        onScroll={measure}
        data-testid="skin-rail"
        className="flex snap-x gap-2 overflow-x-auto px-1 pb-1"
      >
        {children}
      </div>
      {edges.start && (
        <div
          aria-hidden
          data-testid="skin-rail-start"
          className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-start bg-linear-to-r from-slate-800 to-transparent"
        >
          <span className="skin-rail-nudge-left text-xl leading-none text-slate-300">‹</span>
        </div>
      )}
      {edges.end && (
        <div
          aria-hidden
          data-testid="skin-rail-end"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-end bg-linear-to-l from-slate-800 to-transparent"
        >
          <span className="skin-rail-nudge text-xl leading-none text-slate-300">›</span>
        </div>
      )}
    </div>
  );
}

interface MenuScreenProps {
  onPlay: () => void;
  onRanking: () => void;
}

type Panel = 'fases' | 'skins' | 'continue' | null;

// Importado do pacote 'game', não copiado: o valor estava duplicado aqui e
// divergiria em silêncio no dia em que a economia mudasse (D-11/D-18).
const CONTINUE_COST = ECONOMY.CONTINUE_COST;

// Menu hub da PLATAFORMA (D-07, D-20, D-24 — mockup do dono): JOGAR fixo
// embaixo e sempre clicável (RN-03 vale no menu); acima, na ordem, os menus
// Fases · Ranking · Skins · Continue. Cada painel abre inline — nada cobre
// o botão Jogar.
export function MenuScreen({ onPlay, onRanking }: MenuScreenProps) {
  // estado de skins/mundos/carteira vive no pacote 'game' (localStorage) —
  // o reducer só força re-render após interações
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [panel, setPanel] = useState<Panel>(null);
  // galeria (D-19): skin tocada amplia com o nome; null = ninguém ampliado
  const [zoomedSkin, setZoomedSkin] = useState<string | null>(null);

  const balance = gemBalance();
  const selectedWorld = WorldSystem.selected();
  const unlockedWorlds = WorldSystem.unlockedIds();

  const togglePanel = (next: Exclude<Panel, null>): void => {
    setPanel((cur) => (cur === next ? null : next));
  };

  const handleSkinTap = (skin: SkinDef): void => {
    setZoomedSkin(skin.id); // amplia SEMPRE (inclusive "em breve" — D-19)
    if (isSkinUnlocked(skin)) selectSkin(skin.id); // locked não equipa
    refresh();
  };

  const handleWorldTap = (worldId: string): void => {
    if (WorldSystem.select(worldId)) refresh();
  };

  const selectedSkin = getSelectedSkin();
  const menuBtn =
    'w-full rounded-xl border border-slate-600 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700 active:scale-95';

  return (
    <main className="flex min-h-dvh flex-col items-center bg-slate-900 p-6 text-white">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Polity Games</h1>
        <p className="mt-2 text-slate-400">Jogos rápidos. Sátira leve.</p>
      </header>

      <section
        aria-label="Polity Bros"
        className="flex w-full max-w-sm flex-1 flex-col justify-end gap-3 pt-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Polity Bros</h2>
          <p className="mt-1 text-sm text-slate-400">
            Corra pelo Brasil, desvie dos escândalos e colete votos.
          </p>
        </div>

        {/* painéis inline: abrem ACIMA da pilha de menus, sem cobrir o Jogar */}
        {panel === 'fases' && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
              Fases — termine uma para abrir a próxima
            </p>
            <div className="space-y-2">
              {WORLDS.map((w, i) => {
                const unlocked = unlockedWorlds.includes(w.id);
                const selected = w.id === selectedWorld.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => handleWorldTap(w.id)}
                    aria-label={`Fase ${w.name} — ${
                      unlocked ? (selected ? 'selecionada' : 'disponível') : 'bloqueada'
                    }`}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                      selected
                        ? 'bg-slate-700 ring-2 ring-green-400'
                        : unlocked
                          ? 'hover:bg-slate-700/60 active:scale-95'
                          : 'opacity-40 grayscale'
                    }`}
                  >
                    <span className="font-medium">
                      {i + 1}. {w.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {unlocked ? `${w.lengthM}m` : `🔒 termine ${WORLDS[i - 1]?.name ?? ''}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {panel === 'skins' && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            {/* galeria de PERSONAGENS (Fase 4): tocar amplia com nome+lado;
                "em breve" (Juiz/1ª Dama) aparece com cadeado, sem equipar */}
            {zoomedSkin &&
              (() => {
                const skin = SKINS.find((s) => s.id === zoomedSkin);
                if (!skin) return null;
                const unlocked = isSkinUnlocked(skin);
                return (
                  <div className="mb-3 flex flex-col items-center gap-1">
                    <SkinThumb skin={skin} big />
                    <span className="text-sm font-semibold">
                      {skin.label}
                      {skin.side ? <span className="text-slate-400"> · {skin.side}</span> : null}
                    </span>
                    <span className="text-xs text-slate-400">
                      {unlocked
                        ? skin.id === selectedSkin.id
                          ? 'equipada'
                          : 'toque de novo para equipar'
                        : 'em breve'}
                    </span>
                  </div>
                );
              })()}
            {/* Galeria ROLÁVEL na horizontal: antes era `justify-between` com
                `flex-1`, que dividia ~310px por TODAS as skins — com o elenco
                em 7 sobrou ~44px por célula e os labels ("Comunista", "1ª Dama")
                estouravam, parecendo itens sobrepostos. Largura fixa + scroll
                mantém cada card legível e aguenta o elenco crescer (Fase 9). */}
            <SkinRail>
              {SKINS.map((skin) => {
                const unlocked = isSkinUnlocked(skin);
                const selected = skin.id === selectedSkin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => handleSkinTap(skin)}
                    aria-label={`Skin ${skin.label}${skin.side ? ' ' + skin.side : ''} — ${
                      unlocked ? 'disponível' : 'em breve'
                    }`}
                    className={`flex w-16 shrink-0 snap-start flex-col items-center gap-1 rounded-lg p-1.5 transition active:scale-95 ${
                      selected ? 'bg-slate-700 ring-2 ring-green-400' : 'hover:bg-slate-700/60'
                    }`}
                  >
                    <SkinThumb skin={skin} />
                    <span className="w-full truncate text-center text-[10px] leading-tight text-slate-400">
                      {skin.label}
                    </span>
                  </button>
                );
              })}
            </SkinRail>
          </div>
        )}

        {panel === 'continue' && (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm">
            <p>
              <span className="font-semibold text-green-400">💵 {balance} propina{balance === 1 ? '' : 's'}</span>
              {' — '}
              {balance >= CONTINUE_COST
                ? 'dá pra comprar 1 CONTINUE quando você morrer!'
                : `junte ${CONTINUE_COST} e compre 1 CONTINUE pra voltar de onde morreu.`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Propinas aparecem em cima dos blocos flutuantes das fases.
            </p>
            {/* loja futura (D-18/Fase 9): comprar PROPINAS com dinheiro real */}
            <button
              type="button"
              disabled
              className="mt-3 w-full cursor-not-allowed rounded-lg border border-slate-600 py-2 text-xs text-slate-500"
            >
              Comprar propinas — em breve
            </button>
          </div>
        )}

        {/* pilha de menus (D-24): Fases · Ranking · Skins · Continue */}
        <button type="button" onClick={() => togglePanel('fases')} className={menuBtn}>
          🗺️ Fases <span className="text-slate-400">— {selectedWorld.name}</span>
        </button>
        <button type="button" onClick={onRanking} className={menuBtn}>
          🏆 Ranking
        </button>
        <button type="button" onClick={() => togglePanel('skins')} className={menuBtn}>
          🧍 Skins <span className="text-slate-400">— {selectedSkin.label}</span>
        </button>
        <button
          type="button"
          onClick={() => togglePanel('continue')}
          className={`${menuBtn} ${balance >= CONTINUE_COST ? 'menu-tremble border-green-500' : ''}`}
        >
          💵 {balance} propina{balance === 1 ? '' : 's'}{' '}
          <span className="text-slate-400">— Continue</span>
        </button>

        {/* JOGAR: fixo no rodapé do hub, clicável a qualquer momento (D-24) */}
        <button
          type="button"
          onClick={onPlay}
          className="w-full rounded-xl bg-green-500 py-4 text-lg font-bold text-slate-900 transition hover:bg-green-400 active:scale-95"
        >
          Jogar
        </button>
      </section>
    </main>
  );
}
