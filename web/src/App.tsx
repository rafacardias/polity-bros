import { useEffect, useState } from 'react';
import { GameShell } from './components/GameShell';
import { MenuScreen } from './components/MenuScreen';
import { RankingScreen } from './components/RankingScreen';
import { ensureSession } from './lib/session';

type Screen = 'menu' | 'game' | 'ranking';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  // Aquece a sessão anônima (RF-14) enquanto o jogador ainda está no menu,
  // pra ela já estar pronta quando a partida terminar e o score for enviado.
  useEffect(() => {
    ensureSession().catch((err) => console.error('[auth] anonymous sign-in failed', err));
  }, []);

  if (screen === 'game') return <GameShell onExit={() => setScreen('menu')} />;
  if (screen === 'ranking') return <RankingScreen onBack={() => setScreen('menu')} />;
  return <MenuScreen onPlay={() => setScreen('game')} onRanking={() => setScreen('ranking')} />;
}
