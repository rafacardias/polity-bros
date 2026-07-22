import { useEffect } from 'react';
import { createGame, emitGameEvent, SHELL_EVENTS } from 'game';

interface GameShellProps {
  onExit: () => void;
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

  return (
    <div className="relative h-dvh w-full bg-slate-900">
      <button
        type="button"
        onClick={onExit}
        className="absolute left-3 top-3 z-10 rounded-lg bg-slate-800/80 px-3 py-2 text-sm font-medium text-white"
      >
        ← Menu
      </button>
      <div id="game-container" className="h-full w-full" style={{ touchAction: 'none' }} />
    </div>
  );
}
