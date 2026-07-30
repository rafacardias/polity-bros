// Mede se os ciclos de corrida do personagem têm braços de fato ANIMADOS.
//
// Por que existe: o dono reportou que as skins novas deslizam "com os braços
// pra baixo, como um gorila", parados. A animação Phaser está correta (4
// frames, 14fps) — o defeito está no DESENHO. Sem uma métrica, "os braços
// animam agora?" vira opinião; este script transforma isso em número.
//
// Uso:  node scripts/measure-slide-arms.mjs [--run] [char ...]
//       --run  mede o ciclo EM PÉ (<char>-run.png) em vez do agachado
//       sem argumentos, mede todos os personagens conhecidos daquele modo
//       --all  mede os DOIS modos (é o que o portão de commit deve rodar)
//
// PORTÃO: nenhum spritesheet de personagem entra no repositório sem este script
// verde nos dois modos. O motivo de existir a regra: na sessão de 2026-07-24 a
// arte foi commitada REPROVANDO no próprio teste do projeto, porque o script
// existia mas não era bloqueante. Ver docs/adding-characters.md.
//
// Métricas do modo AGACHADO, calibradas contra o Centrão (referência aprovada
// pelo dono no commit 93d1097) e contra as 4 skins que ele reprovou:
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
//
// Modo EM PÉ (--run): não existe `compact` (não há largura de referência), então
// entra `legAmp` — a amplitude da silhueta na faixa das PERNAS. Um ciclo de
// corrida em que as pernas se movem mas os braços não é exatamente o defeito
// que o dono relatou na skin `esquerda`, e só medir armAmp não distinguiria
// "arte parada" de "arte que anda mal".
// Calibração do modo em pé (medida em 2026-07-29):
//   centrao 24 · comunista 18 · patriota 15 · direita 13 · centrao-faixa 10
//   esquerda 5  ← a reprovada relatada pelo dono
// Limiar 10: aceita todas as aprovadas (centrao-faixa é o piso) e reprova a
// `esquerda` com folga.
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

const RUNS = {
  centrao: { w: 64, h: 82 },
  'centrao-faixa': { w: 59, h: 82 },
  patriota: { w: 58, h: 82 },
  comunista: { w: 57, h: 82 },
  direita: { w: 58, h: 82 },
  esquerda: { w: 63, h: 82 },
};

const FRAMES = 4;
const ALPHA_MIN = 40; // abaixo disso é fundo/antialias, não corpo

// Faixa vertical dos braços. No AGACHADO o tronco fica achatado, então a janela
// é ampla de propósito (mantida exatamente como calibrada). Em PÉ o corpo é
// alongado e a faixa das pernas precisa ficar fora da janela dos braços.
const WINDOWS = {
  slide: { armTop: 0.3, armBottom: 0.62, legTop: null },
  run: { armTop: 0.3, armBottom: 0.6, legTop: 0.62 },
};

// Decodifica um frame do sheet como RGBA cru (ffmpeg faz o recorte e a conversão).
function frameRGBA(char, suffix, index, w, h) {
  const out = join(tmpdir(), `sheet-${char}-${suffix}-${index}.rgba`);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    join(SPRITES, `${char}-${suffix}.png`),
    '-vf',
    `crop=${w}:${h}:${index * w}:0,format=rgba`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    out,
  ]);
  const buf = readFileSync(out);
  unlinkSync(out);
  return buf;
}

const opaque = (buf, w, x, y) => buf[(y * w + x) * 4 + 3] >= ALPHA_MIN;

// largura da silhueta dentro de uma faixa vertical (fração da altura)
function span(buf, w, h, top, bottom) {
  let min = Infinity;
  let max = -Infinity;
  for (let y = Math.floor(h * top); y < Math.floor(h * bottom); y++) {
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

// Limiares do AGACHADO, calibrados nas 6 skins (Centrão aprovado; as 4 novas
// reprovadas). NÃO mexer sem recalibrar contra o Centrão.
const MAX_COMPACT = 0.9; // agachado tem de ser MAIS ESTREITO que a corrida
const MIN_ARM_AMP = 6;
const MAX_IOU = 0.95;
// Limiar do EM PÉ (ver nota de calibração no topo).
const MIN_RUN_ARM_AMP = 10;

function measure(mode, char) {
  const suffix = mode === 'run' ? 'run' : 'slide';
  const dim = (mode === 'run' ? RUNS : SLIDES)[char];
  if (!dim) {
    console.log(`${char.padEnd(14)} — desconhecido (adicione em ${mode === 'run' ? 'RUNS' : 'SLIDES'})`);
    return false;
  }
  const win = WINDOWS[mode === 'run' ? 'run' : 'slide'];
  const frames = Array.from({ length: FRAMES }, (_, i) =>
    frameRGBA(char, suffix, i, dim.w, dim.h),
  );
  const arms = frames.map((f) => span(f, dim.w, dim.h, win.armTop, win.armBottom));
  const armAmp = Math.max(...arms) - Math.min(...arms);

  let maxIoU = 0;
  for (let i = 0; i < FRAMES; i++) {
    for (let j = i + 1; j < FRAMES; j++) {
      maxIoU = Math.max(maxIoU, iou(frames[i], frames[j], dim.w, dim.h));
    }
  }

  if (mode === 'run') {
    const legs = frames.map((f) => span(f, dim.w, dim.h, win.legTop, 1));
    const legAmp = Math.max(...legs) - Math.min(...legs);
    const ok = armAmp >= MIN_RUN_ARM_AMP && maxIoU <= MAX_IOU;
    console.log(
      `${ok ? 'OK  ' : 'FALHA'} ${char.padEnd(14)} [em pé]     ` +
        `armAmp=${String(armAmp).padStart(2)} (min ${MIN_RUN_ARM_AMP})  ` +
        `legAmp=${String(legAmp).padStart(2)}  maxIoU=${maxIoU.toFixed(2)} (max ${MAX_IOU})`,
    );
    return ok;
  }

  const compact = dim.w / dim.runW;
  const ok = compact <= MAX_COMPACT && armAmp >= MIN_ARM_AMP && maxIoU <= MAX_IOU;
  console.log(
    `${ok ? 'OK  ' : 'FALHA'} ${char.padEnd(14)} [agachado]  compact=${compact.toFixed(2)} (max ${MAX_COMPACT})  ` +
      `armAmp=${String(armAmp).padStart(2)} (min ${MIN_ARM_AMP})  ` +
      `maxIoU=${maxIoU.toFixed(2)} (max ${MAX_IOU})`,
  );
  return ok;
}

const argv = process.argv.slice(2);
const wantRun = argv.includes('--run');
const wantAll = argv.includes('--all');
const chars = argv.filter((a) => !a.startsWith('--'));
const modes = wantAll ? ['slide', 'run'] : [wantRun ? 'run' : 'slide'];

let failures = 0;
for (const mode of modes) {
  const targets = chars.length ? chars : Object.keys(mode === 'run' ? RUNS : SLIDES);
  for (const char of targets) if (!measure(mode, char)) failures++;
}

process.exit(failures > 0 ? 1 : 0);
