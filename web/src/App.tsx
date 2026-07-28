import { useEffect, useRef, useState } from 'react';
import { GAME_EVENTS, onGameEvent } from 'game';
import type { GameEventPayload } from 'game';
import { GameShell } from './components/GameShell';
import { MenuScreen } from './components/MenuScreen';
import { RankingScreen } from './components/RankingScreen';
import { SocialSpotlight } from './components/SocialSpotlight';
import { fetchRankingContext, type RankingContext } from './lib/ranking';
import { initScoreQueue } from './lib/scoreQueue';
import { ensureSession } from './lib/session';
import { submitScore } from './lib/submitScore';
import { trackRunEnd } from './lib/telemetry';

type Screen = 'menu' | 'game' | 'ranking';

interface Spotlight {
  payload: GameEventPayload;
  context: RankingContext;
  loading: boolean; // ranking ainda em voo — as colunas mostram "…"
}

// Ranking vazio exibido enquanto submitScore/fetchRankingContext estão em voo.
// Constante de módulo (não literal inline) para manter a identidade estável
// entre renders.
const PENDING_CONTEXT: RankingContext = { position: null, topGlobal: [], topPersonal: [] };

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

  // T07E-01/RN-01: reenvia scores presos na fila offline (falha de rede em
  // partidas anteriores) assim que a conexão volta, e uma vez no boot.
  useEffect(() => {
    initScoreQueue();
  }, []);

  // T05-04/D-08 + review 7B: o submit vive no App (não no GameShell) porque
  // o game:gameover de uma morte pendente é emitido no SHUTDOWN da cena —
  // que acontece DEPOIS do unmount do shell quando o jogador sai pro menu
  // durante a oferta de continue. Aqui o listener sobrevive e o score entra.
  useEffect(() => {
    return onGameEvent<GameEventPayload>(GAME_EVENTS.GAME_OVER, (payload) => {
      const token = ++tokenSeqRef.current;
      activeTokenRef.current = token;

      // RF-16: o spotlight nasce JÁ, com o ranking vazio, e é preenchido quando
      // a rede responde. Antes ele só montava DEPOIS de submitScore +
      // fetchRankingContext; como o game over aceita toque em ~400ms (RN-03),
      // na derrota o jogador reiniciava antes das duas requisições resolverem,
      // o token era invalidado e o botão "Compartilhar" nunca chegava a existir
      // — só aparecia na vitória, onde ele para para ler a celebração.
      // Gameover emitido no SHUTDOWN (já no menu) segue sem spotlight.
      setSpotlight(
        screenRef.current === 'game'
          ? { payload, context: PENDING_CONTEXT, loading: true }
          : null,
      );

      // fora do try e antes do submit: a telemetria não depende do envio do
      // score, e ficando depois ela se perdia em silêncio sempre que
      // submitScore lançasse (localStorage cheio, Safari privado)
      trackRunEnd(payload); // telemetria leve (T07A-05, D-10)

      void (async () => {
        try {
          await submitScore(payload);
          const context = await fetchRankingContext(payload.score); // T07D-03/D-15

          // invalidado por um reinício (game:score) ou por um gameover mais novo
          if (activeTokenRef.current !== token) return;
          // jogador já saiu pro menu — não mostra o spotlight fora do jogo
          if (screenRef.current !== 'game') return;
          setSpotlight({ payload, context, loading: false });
        } catch (err) {
          // sem try/catch isto virava unhandled rejection e o spotlight ficava
          // preso em "carregando" para sempre. O score não se perde: o
          // scoreQueue (T07E-01) reenvia quando a rede voltar.
          console.error('[gameover] pós-processamento falhou', err);
        }
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

  // sair pro menu invalida o spotlight da run anterior — senão ele reapareceria
  // (com score/posição velhos) ao voltar pro jogo antes do próximo gameover.
  function exitToMenu() {
    activeTokenRef.current = null;
    setSpotlight(null);
    setScreen('menu');
  }

  if (screen === 'game') {
    return (
      <>
        <GameShell onExit={exitToMenu} />
        {spotlight && (
          <SocialSpotlight
            payload={spotlight.payload}
            context={spotlight.context}
            loading={spotlight.loading}
            ownPlayerId={ownPlayerId}
          />
        )}
      </>
    );
  }
  if (screen === 'ranking') return <RankingScreen onBack={() => setScreen('menu')} />;
  return <MenuScreen onPlay={() => setScreen('game')} onRanking={() => setScreen('ranking')} />;
}
