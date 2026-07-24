import { useEffect } from 'react';
import { createGame, emitGameEvent, SHELL_EVENTS } from 'game';

interface GameShellProps {
  onExit: () => void;
}

// Placeholder de anúncio (D-11): banner só entra na Fase 9 e SÓ após ~5 partidas,
// pra não estragar a primeira experiência do jogador novo. Enquanto isso, esta
// faixa-fantasma existe só para PRÉ-VISUALIZAR o layout: reserva o espaço no topo
// e deixa o dono sentir a pista real (o Phaser usa Scale.RESIZE → o canvas encolhe
// sozinho pro espaço que sobra, simulando produção sem tocar em física).
//
// Gate por URL (?ad=top): visível só para quem tem o link. Usuário comum nunca vê
// o mock. Topo, não rodapé — o jogo é "tocar em qualquer lugar = pular"; banner no
// polegar geraria toque acidental (tráfego inválido que o AdSense pune). Altura de
// banner âncora adaptável típico em celular.
const AD_SLOT_H = 60;

function adSlot(): 'top' | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('ad') === 'top' ? 'top' : null;
}

// Monta o Phaser em container DIV — NUNCA iframe (D-05, RN-05).
// O React é dono do ciclo de vida: instância NOVA no mount,
// game.destroy(true) no unmount — remontar é sempre seguro.
export function GameShell({ onExit }: GameShellProps) {
  useEffect(() => {
    const game = createGame('game-container');
    // handle de teste E2E só fora de produção: deixa o Playwright inspecionar a
    // cena viva via window.__game (score, grupos de entidades, colisões). Usa
    // MODE, não DEV/PROD — nesta stack só MODE strippa de fato (ver main.tsx:16),
    // então em produção este bloco vira dead-code e some do bundle.
    if (import.meta.env.MODE !== 'production') {
      (window as unknown as { __game: typeof game }).__game = game;
    }
    // instância destruída não pode anunciar menu:play (StrictMode remonta em dev);
    // flag local em vez de events.off, que removeria listeners INTERNOS do boot
    let disposed = false;
    // RF-02: sinaliza o início da partida assim que o Phaser estiver pronto
    game.events.once('ready', () => {
      if (!disposed) emitGameEvent(SHELL_EVENTS.PLAY);
    });

    // o submit do score vive no App (review 7B) — aqui só o ciclo de vida
    return () => {
      disposed = true;
      game.destroy(true);
    };
  }, []);

  // decidido ANTES do mount: o game-container já nasce com o tamanho reduzido, então
  // o Phaser lê a altura certa no boot e não precisa de re-layout em runtime.
  const showAd = adSlot() === 'top';

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-900">
      {showAd && (
        <div
          className="flex shrink-0 items-center justify-center border-b border-dashed border-slate-500 bg-slate-800/60 text-[11px] font-medium uppercase tracking-wider text-slate-400"
          style={{ height: AD_SLOT_H }}
        >
          área de anúncio · 320×60 (placeholder)
        </div>
      )}
      {/* min-h-0 é essencial: sem ele o item flex herda min-height:auto e cresce
          pra caber o canvas do Phaser (Scale.RESIZE), inflando a altura num loop.
          Com min-h-0 o wrapper ocupa exatamente o espaço restante e o canvas o segue. */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
        <button
          type="button"
          onClick={onExit}
          className="absolute left-3 top-3 z-10 rounded-lg bg-slate-800/80 px-3 py-2 text-sm font-medium text-white"
        >
          ← Menu
        </button>
        <div id="game-container" className="h-full w-full" style={{ touchAction: 'none' }} />
      </div>
    </div>
  );
}
