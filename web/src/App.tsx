import { useEffect, useRef, useState } from 'react';
import { GAME_EVENTS, onGameEvent } from 'game';
import type { GameEventPayload } from 'game';
import { GameShell } from './components/GameShell';
import { MenuScreen } from './components/MenuScreen';
import { RankingScreen } from './components/RankingScreen';
import { SocialSpotlight } from './components/SocialSpotlight';
import { fetchRankingContext, type RankingContext } from './lib/ranking';
import { ensureSession } from './lib/session';
import { submitScore } from './lib/submitScore';
import { trackRunEnd } from './lib/telemetry';

type Screen = 'menu' | 'game' | 'ranking';

interface Spotlight {
  payload: GameEventPayload;
  context: RankingContext;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [ownPlayerId, setOwnPlayerId] = useState<string | null>(null);

  // screenRef espelha `screen` sem forçar o listener de GAME_OVER a
  // re-subscrever a cada troca de tela (o listener é montado uma vez só).
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // token da sessão de spotlight "viva" (pendente ou já exibida). Invalidado
  // por: (a) um GAME_OVER mais novo chegando, (b) um game:score chegando
  // enquanto há uma sessão viva — sinal de que o jogador já reiniciou (T07D-03).
  const activeTokenRef = useRef<number | null>(null);
  const tokenSeqRef = useRef(0);

  // Aquece a sessão anônima (RF-14) enquanto o jogador ainda está no menu,
  // pra ela já estar pronta quando a partida terminar e o score for enviado.
  useEffect(() => {
    ensureSession()
      .then((session) => setOwnPlayerId(session.user.id))
      .catch((err) => console.error('[auth] anonymous sign-in failed', err));
  }, []);

  // T05-04/D-08 + review 7B: o submit vive no App (não no GameShell) porque
  // o game:gameover de uma morte pendente é emitido no SHUTDOWN da cena —
  // que acontece DEPOIS do unmount do shell quando o jogador sai pro menu
  // durante a oferta de continue. Aqui o listener sobrevive e o score entra.
  useEffect(() => {
    return onGameEvent<GameEventPayload>(GAME_EVENTS.GAME_OVER, (payload) => {
      const token = ++tokenSeqRef.current;
      activeTokenRef.current = token;
      setSpotlight(null); // gameover em sequência: o mais novo substitui o anterior

      void (async () => {
        await submitScore(payload);
        trackRunEnd(payload); // telemetria leve (T07A-05, D-10)
        const context = await fetchRankingContext(payload.score); // T07D-03/D-15

        // invalidado por um reinício (game:score) ou por um gameover mais novo
        if (activeTokenRef.current !== token) return;
        // jogador já saiu pro menu — não mostra o spotlight fora do jogo
        if (screenRef.current !== 'game') return;
        setSpotlight({ payload, context });
      })();
    });
  }, []);

  // game:score só volta a disparar depois de um gameover se o jogador tocou
  // pra reiniciar (GameOverScene aceita input imediatamente, D-15/RN-03) —
  // nesse caso o spotlight da run anterior perde a validade na hora.
  useEffect(() => {
    return onGameEvent(GAME_EVENTS.SCORE, () => {
      if (activeTokenRef.current === null) return;
      activeTokenRef.current = null;
      setSpotlight(null);
    });
  }, []);

  if (screen === 'game') {
    return (
      <>
        <GameShell onExit={() => setScreen('menu')} />
        {spotlight && (
          <SocialSpotlight
            payload={spotlight.payload}
            context={spotlight.context}
            ownPlayerId={ownPlayerId}
          />
        )}
      </>
    );
  }
  if (screen === 'ranking') return <RankingScreen onBack={() => setScreen('menu')} />;
  return <MenuScreen onPlay={() => setScreen('game')} onRanking={() => setScreen('ranking')} />;
}
