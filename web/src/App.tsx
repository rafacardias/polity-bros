import { useState } from 'react';
import { GameShell } from './components/GameShell';
import { MenuScreen } from './components/MenuScreen';

type Screen = 'menu' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  return screen === 'menu' ? (
    <MenuScreen onPlay={() => setScreen('game')} />
  ) : (
    <GameShell onExit={() => setScreen('menu')} />
  );
}
