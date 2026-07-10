import { useEffect, useState } from 'react';
import { GAME_EVENTS, onGameEvent } from 'game';
import type { GameEventPayload } from 'game';
import { GameShell } from './components/GameShell';
import { MenuScreen } from './components/MenuScreen';
import { RankingScreen } from './components/RankingScreen';
import { ensureSession } from './lib/session';
import { submitScore } from './lib/submitScore';
import { trackRunEnd } from './lib/telemetry';

type Screen = 'menu' | 'game' | 'ranking';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  // Aquece a sessão anônima (RF-14) enquanto o jogador ainda está no menu,
  // pra ela já estar pronta quando a partida terminar e o score for enviado.
  useEffect(() => {
    ensureSession().catch((err) => console.error('[auth] anonymous sign-in failed', err));
  }, []);

  // T05-04/D-08 + review 7B: o submit vive no App (não no GameShell) porque
  // o game:gameover de uma morte pendente é emitido no SHUTDOWN da cena —
  // que acontece DEPOIS do unmount do shell quando o jogador sai pro menu
  // durante a oferta de continue. Aqui o listener sobrevive e o score entra.
  useEffect(() => {
    return onGameEvent<GameEventPayload>(GAME_EVENTS.GAME_OVER, (payload) => {
      void submitScore(payload);
      trackRunEnd(payload); // telemetria leve (T07A-05, D-10)
    });
  }, []);

  if (screen === 'game') return <GameShell onExit={() => setScreen('menu')} />;
  if (screen === 'ranking') return <RankingScreen onBack={() => setScreen('menu')} />;
  return <MenuScreen onPlay={() => setScreen('game')} onRanking={() => setScreen('ranking')} />;
}
