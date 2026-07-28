// Mede se o ciclo de corrida-agachada tem braços de fato ANIMADOS.
//
// Por que existe: o dono reportou que as skins novas deslizam "com os braços
// pra baixo, como um gorila", parados. A animação Phaser está correta (4
// frames, 14fps) — o defeito está no DESENHO. Sem uma métrica, "os braços
// animam agora?" vira opinião; este script transforma isso em número.
//
// Uso:  node scripts/measure-slide-arms.mjs [char ...]
// Sem argumentos, mede todos os personagens conhecidos.
//
// Três métricas, calibradas contra o Centrão (referência aprovada pelo dono no
// commit 93d1097) e contra as 4 skins que ele reprovou:
//   compact — largura do frame agachado ÷ largura do frame de corrida. É a que
//             pega a "pose de gorila": braço pendurado à frente ESTICA a
//             silhueta. Centrão 0.83 · reprovadas 0.98–1.18. A mais decisiva.
//   armAmp  — variação, entre os frames, da largura da silhueta na faixa dos
//             braços. Braço que balança muda a largura; braço congelado não.
//   maxIoU  — maior sobreposição entre dois frames quaisquer. Perto de 1,00
//             significa frames repetidos (ciclo falso).
//
// Calibração importante: uma primeira versão deste script usava só armAmp e
// maxIoU, e teria APROVADO o comunista (armAmp 10, maior que o do Centrão) —
// que o dono reprovou — e REPROVADO o próprio Centrão no IoU. Os limiares
// abaixo separam corretamente aprovado de reprovado nas 6 skins.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath e não .pathname: o repositório vive em "--Polity Bros" e o
// espaço viraria %20, quebrando o ffmpeg.
const SPRITES = fileURLToPath(new URL('../game/public/assets/sprites/', import.meta.url));

// frameWidth/frameHeight espelham SPRITESHEET_ASSETS em game/src/data/assets-manifest.ts
const SLIDES = {
  centrao: { w: 53, h: 61, runW: 64 },
  'centrao-faixa': { w: 48, h: 61, runW: 59 },
  patriota: { w: 65, h: 60, runW: 58 },
  comunista: { w: 67, h: 60, runW: 57 },
  direita: { w: 65, h: 61, runW: 58 },
  esquerda: { w: 62, h: 61, runW: 63 },
};

const FRAMES = 4;
const ALPHA_MIN = 40; // abaixo disso é fundo/antialias, não corpo
// Faixa vertical dos braços: abaixo da cabeça e acima das pernas. No agachado
// o tronco fica achatado, então a janela é ampla de propósito.
const ARM_TOP = 0.3;
const ARM_BOTTOM = 0.62;

// Decodifica um frame do sheet como RGBA cru (ffmpeg faz o recorte e a conversão).
function frameRGBA(char, index, w, h) {
  const out = join(tmpdir(), `slide-${char}-${index}.rgba`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', join(SPRITES, `${char}-slide.png`),
    '-vf', `crop=${w}:${h}:${index * w}:0,format=rgba`,
    '-f', 'rawvideo', '-pix_fmt', 'rgba', out,
  ]);
  const buf = readFileSync(out);
  unlinkSync(out);
  return buf;
}

const opaque = (buf, w, x, y) => buf[(y * w + x) * 4 + 3] >= ALPHA_MIN;

// largura da silhueta dentro da faixa dos braços
function armSpan(buf, w, h) {
  let min = Infinity;
  let max = -Infinity;
  for (let y = Math.floor(h * ARM_TOP); y < Math.floor(h * ARM_BOTTOM); y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(buf, w, x, y)) continue;
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  return max < min ? 0 : max - min + 1;
}

function iou(a, b, w, h) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < w * h; i++) {
    const pa = a[i * 4 + 3] >= ALPHA_MIN;
    const pb = b[i * 4 + 3] >= ALPHA_MIN;
    if (pa && pb) inter++;
    if (pa || pb) union++;
  }
  return union === 0 ? 1 : inter / union;
}

// Limiares calibrados nas 6 skins (Centrão aprovado; as 4 novas reprovadas).
const MAX_COMPACT = 0.9; // agachado tem de ser MAIS ESTREITO que a corrida
const MIN_ARM_AMP = 6;
const MAX_IOU = 0.95;

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SLIDES);
let failures = 0;

for (const char of targets) {
  const dim = SLIDES[char];
  if (!dim) {
    console.log(`${char.padEnd(14)} — desconhecido (adicione em SLIDES)`);
    continue;
  }
  const frames = Array.from({ length: FRAMES }, (_, i) => frameRGBA(char, i, dim.w, dim.h));
  const spans = frames.map((f) => armSpan(f, dim.w, dim.h));
  const armAmp = Math.max(...spans) - Math.min(...spans);

  let maxIoU = 0;
  for (let i = 0; i < FRAMES; i++) {
    for (let j = i + 1; j < FRAMES; j++) {
      maxIoU = Math.max(maxIoU, iou(frames[i], frames[j], dim.w, dim.h));
    }
  }

  const compact = dim.w / dim.runW;
  const ok = compact <= MAX_COMPACT && armAmp >= MIN_ARM_AMP && maxIoU <= MAX_IOU;
  if (!ok) failures++;
  console.log(
    `${ok ? 'OK  ' : 'FALHA'} ${char.padEnd(14)} compact=${compact.toFixed(2)} (max ${MAX_COMPACT})  ` +
      `armAmp=${String(armAmp).padStart(2)} (min ${MIN_ARM_AMP})  ` +
      `maxIoU=${maxIoU.toFixed(2)} (max ${MAX_IOU})`,
  );
}

process.exit(failures > 0 ? 1 : 0);
