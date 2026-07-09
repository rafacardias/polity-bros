import { useEffect } from 'react';
import { createGame, emitGameEvent, GAME_EVENTS, onGameEvent, SHELL_EVENTS } from 'game';
import type { GameEventPayload } from 'game';
import { submitScore } from '../lib/submitScore';

interface GameShellProps {
  onExit: () => void;
}

// Monta o Phaser em container DIV — NUNCA iframe (D-05, RN-05).
// O React é dono do ciclo de vida: instância NOVA no mount,
// game.destroy(true) no unmount — remontar é sempre seguro.
export function GameShell({ onExit }: GameShellProps) {
  useEffect(() => {
    const game = createGame('game-container');
    // instância destruída não pode anunciar menu:play (StrictMode remonta em dev);
    // flag local em vez de events.off, que removeria listeners INTERNOS do boot
    let disposed = false;
    // RF-02: sinaliza o início da partida assim que o Phaser estiver pronto
    game.events.once('ready', () => {
      if (!disposed) emitGameEvent(SHELL_EVENTS.PLAY);
    });

    // T05-04/D-08: ao morrer, envia o score pra Edge Function (JWT + elapsedSec)
    const offGameOver = onGameEvent<GameEventPayload>(GAME_EVENTS.GAME_OVER, (payload) => {
      void submitScore(payload);
    });

    return () => {
      disposed = true;
      offGameOver();
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
