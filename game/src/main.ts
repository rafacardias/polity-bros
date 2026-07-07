import { createGame } from './index';

// Dev harness: roda o jogo STANDALONE (npm run dev -w game) durante o
// desenvolvimento das tasks de gameplay, sem precisar do shell React.
// Em produção, quem monta o jogo é o GameShell (/web) via createGame().
createGame('game-container');
