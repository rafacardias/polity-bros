import type { GameEventPayload } from 'game';

// T07D-04/D-12: imagem de share 4:5 (1080×1350) — proporção confortável pra
// WhatsApp Status e feed do Instagram sem crop agressivo.
const SHARE_WIDTH = 1080;
const SHARE_HEIGHT = 1350;
const SHARE_URL = 'https://polity-bros.vercel.app';

// Gera a imagem de compartilhamento em canvas offscreen. Nunca lança — falha
// em qualquer etapa (canvas indisponível, screenshot corrompido, toBlob sem
// suporte) vira `null` e quem chama decide o que fazer (ex.: não mostrar CTA).
export async function composeShareImage(
  payload: GameEventPayload,
  username: string | null,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SHARE_WIDTH;
    canvas.height = SHARE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await drawBackground(ctx, payload.screenshot);
    drawOverlayGradients(ctx);
    drawFrame(ctx);
    drawText(ctx, payload, username);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (err) {
    console.error('[composeShareImage] failed', err);
    return null;
  }
}

async function drawBackground(ctx: CanvasRenderingContext2D, screenshot?: string): Promise<void> {
  if (!screenshot) {
    fillSolidBackground(ctx);
    return;
  }

  try {
    const img = await loadImage(screenshot);
    // cover-fit: preenche o canvas inteiro sem distorcer, cropando o excesso.
    const scale = Math.max(SHARE_WIDTH / img.width, SHARE_HEIGHT / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (SHARE_WIDTH - w) / 2, (SHARE_HEIGHT - h) / 2, w, h);
  } catch {
    fillSolidBackground(ctx);
  }
}

function fillSolidBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('[shareImage] screenshot failed to decode'));
    img.src = src;
  });
}

function drawOverlayGradients(ctx: CanvasRenderingContext2D): void {
  // faixa escura embaixo pra legibilidade do score/CTA sobre o screenshot
  const bottom = ctx.createLinearGradient(0, SHARE_HEIGHT * 0.45, 0, SHARE_HEIGHT);
  bottom.addColorStop(0, 'rgba(2, 6, 23, 0)');
  bottom.addColorStop(1, 'rgba(2, 6, 23, 0.92)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // faixa leve no topo pra legibilidade do título
  const top = ctx.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, 'rgba(2, 6, 23, 0.75)');
  top.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, SHARE_WIDTH, 220);
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)'; // slate-400
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, SHARE_WIDTH - 40, SHARE_HEIGHT - 40);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  payload: GameEventPayload,
  username: string | null,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#f8fafc'; // slate-50
  ctx.font = 'bold 56px monospace';
  ctx.fillText('POLITY BROS', SHARE_WIDTH / 2, 130);

  ctx.fillStyle = '#4ade80'; // emerald-400
  ctx.font = 'bold 150px monospace';
  ctx.fillText(`${payload.score} pts`, SHARE_WIDTH / 2, 1050);

  const stars = '⭐'.repeat(payload.stars ?? 0);
  const distanceM = Math.round(payload.distance);
  const statsLine = [stars || null, `${payload.votes} votos`, `${distanceM}m`]
    .filter((part): part is string => Boolean(part))
    .join('  ·  ');
  ctx.fillStyle = '#e2e8f0'; // slate-200
  ctx.font = '42px monospace';
  ctx.fillText(statsLine, SHARE_WIDTH / 2, 1130);

  let y = 1130;
  if (username) {
    y += 60;
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = 'italic 34px monospace';
    ctx.fillText(`por @${username}`, SHARE_WIDTH / 2, y);
  }

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('bata este recorde em polity-bros.vercel.app', SHARE_WIDTH / 2, SHARE_HEIGHT - 60);
}

export type ShareResult = 'shared' | 'downloaded' | 'failed';

// Tenta Web Share API (nativo em mobile — cai direto no WhatsApp/Instagram
// do usuário); sem suporte/capability recusada, baixa o PNG via <a download>.
// Cancelamento explícito do usuário (AbortError) não deve baixar por cima.
export async function shareScoreImage(blob: Blob, score: number): Promise<ShareResult> {
  const file = new File([blob], 'polity-bros-score.png', { type: 'image/png' });
  const shareText = `Fiz ${score} pts no Polity Bros! Bata meu recorde:`;

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText, url: SHARE_URL });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
      // qualquer outra falha (ex.: share sheet rejeitado pelo SO) cai pro download
    }
  }

  return downloadImage(blob);
}

function downloadImage(blob: Blob): ShareResult {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'polity-bros-score.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch (err) {
    console.error('[shareScoreImage] download fallback failed', err);
    return 'failed';
  }
}
