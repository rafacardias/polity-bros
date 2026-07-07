import { createGame } from './index';

// Dev harness: roda o jogo STANDALONE (npm run dev -w game) durante o
// desenvolvimento das tasks de gameplay, sem precisar do shell React.
// Em produção, quem monta o jogo é o GameShell (/web) via createGame().
const game = createGame('game-container');

// instância exposta APENAS no harness — usada pelos testes E2E (puppeteer)
Object.assign(window, { __game: game });
