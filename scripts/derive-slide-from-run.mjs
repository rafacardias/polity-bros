// Deriva o sheet AGACHADO a partir do sheet de CORRIDA do mesmo personagem.
//
// Por que existe (D-34): os agachados gerados por IA vieram com o braço
// pendurado reto e os 4 frames quase idênticos — "gorila parado", nas palavras
// do dono. O ciclo de corrida em pé das mesmas skins, porém, ANIMA bem. Então
// em vez de apostar de novo na IA, o agachado passa a ser uma transformação
// determinística do ciclo que já funciona: comprime em Y (fica mais baixo) e em
// X (fica mais estreito que a corrida, que é o critério `compact`).
//
// TRADE-OFF ACEITO PELO DONO, explicitamente: o resultado lê como "personagem
// mais baixo correndo", não como "agachando para passar por baixo". Perde
// legibilidade de gameplay contra a câmera voadora; ganha braços que de fato se
// movem e uma silhueta que não estica. É reversível num commit, e a intenção é
// substituir por arte desenhada quando houver.
//
// NÃO toca em centrao nem em centrao-faixa: o agachado deles é desenhado, foi
// aprovado pelo dono e é a REFERÊNCIA de calibração do portão de medição.
//
// Uso:  node scripts/derive-slide-from-run.mjs [char ...]
//       (sem argumentos, processa todos os DERIVED abaixo)
//
// Depois de rodar, obrigatoriamente:
//   1. atualizar frameWidth/frameHeight em SPRITESHEET_ASSETS (assets-manifest)
//   2. node scripts/measure-slide-arms.mjs --all
//
// O `-air` NÃO precisa ser reextraído: ele é recorte do `-run`, que não muda aqui.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// fileURLToPath e não .pathname: o repositório vive em "--Polity Bros" e o
// espaço viraria %20, quebrando o ffmpeg.
const SPRITES = fileURLToPath(new URL('../game/public/assets/sprites/', import.meta.url));

// runW/runH espelham SPRITESHEET_ASSETS; slideH mantém a altura do agachado
// atual de cada skin (a hitbox é fixa e independente da arte — RN-07).
//
// COMPACT_TARGET 0.88 e não 0.90: 0.90 é o limiar do portão, e encostar nele
// deixaria a arte a um pixel de reprovar em qualquer reajuste futuro.
const COMPACT_TARGET = 0.88;
const DERIVED = {
  patriota: { runW: 58, runH: 82, slideH: 60 },
  comunista: { runW: 57, runH: 82, slideH: 60 },
  direita: { runW: 58, runH: 82, slideH: 61 },
  esquerda: { runW: 63, runH: 82, slideH: 61 },
};

const FRAMES = 4;

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DERIVED);

for (const char of targets) {
  const dim = DERIVED[char];
  if (!dim) {
    console.log(`${char} — desconhecido (adicione em DERIVED)`);
    continue;
  }
  const frameW = Math.floor(dim.runW * COMPACT_TARGET);
  // Escala o sheet INTEIRO de uma vez: os frames têm largura igual e a escala é
  // uniforme, então isso é idêntico a escalar frame a frame — sem risco de
  // desalinhar as colunas ao remontar.
  const outW = frameW * FRAMES;
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    join(SPRITES, `${char}-run.png`),
    '-vf',
    `scale=${outW}:${dim.slideH}:flags=lanczos`,
    join(SPRITES, `${char}-slide.png`),
  ]);
  console.log(
    `${char.padEnd(12)} slide derivado  frame=${frameW}x${dim.slideH}  ` +
      `sheet=${outW}x${dim.slideH}  compact=${(frameW / dim.runW).toFixed(2)}`,
  );
}
