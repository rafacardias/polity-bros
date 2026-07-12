import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { postScore, type ScoreBody } from './submitScore';

// T07E-01/RN-01: resiliência de rede no submit de score. A partida roda
// 100% local; se o envio falhar por REDE (não por rejeição do servidor), o
// score entra numa fila persistida e é reenviado quando a conexão voltar.
const STORAGE_KEY = 'polity-bros:score-queue';
// Espelha o teto do rate limit da Edge Function (RN-04, MAX_SUBMITS_PER_WINDOW):
// não faz sentido guardar mais do que cabe numa janela de 10min.
const MAX_QUEUE_SIZE = 30;
// > MIN_SUBMIT_INTERVAL do servidor (2s) — margem de segurança entre retries.
const DRAIN_SPACING_MS = 2500;
// Atraso do drain inicial no boot pra não competir com o aquecimento da
// sessão anônima (ensureSession em App.tsx).
const INITIAL_DRAIN_DELAY_MS = 3000;

let draining = false;
let initialized = false;

function readQueue(): ScoreBody[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoreBody[]) : [];
  } catch {
    // modo privado / storage indisponível — fila vira no-op silencioso
    return [];
  }
}

function writeQueue(queue: ScoreBody[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // sem storage disponível — no-op silencioso, submit segue como hoje
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function enqueueScore(body: ScoreBody): void {
  const queue = readQueue();
  queue.push(body);
  while (queue.length > MAX_QUEUE_SIZE) queue.shift(); // cheia: descarta a MAIS ANTIGA
  writeQueue(queue);
}

// Reenvia a fila em ordem, espaçado pelo intervalo mínimo entre submits do
// servidor. Um drain por vez — chamadas concorrentes (evento `online` +
// drain inicial do boot, por ex.) retornam sem fazer nada.
export async function drainScoreQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    let queue = readQueue();

    while (queue.length > 0) {
      if (!navigator.onLine) break; // sem rede — nem tenta, mantém a fila

      const next = queue[0];
      const { error } = await postScore(next);

      if (error instanceof FunctionsFetchError) break; // falha de rede — para, mantém o restante
      if (error instanceof FunctionsHttpError) {
        const status = (error.context as Response | undefined)?.status;
        if (status === 429) break; // rate limited — tenta de novo na próxima janela
      }
      // sucesso, OU outra rejeição HTTP (validação/anti-cheat) — não insiste.
      // Remove o item enviado RELENDO o storage: um gameover durante o await
      // acima pode ter enfileirado score novo, e regravar o snapshot local
      // antigo o apagaria (só o drain remove; enqueue só faz append no fim).
      queue = readQueue();
      queue.shift();
      writeQueue(queue);

      if (queue.length > 0) await sleep(DRAIN_SPACING_MS);
    }
  } finally {
    draining = false;
  }
}

// Registra os gatilhos de reenvio: volta de conexão e uma tentativa inicial
// no boot. Idempotente — chamar mais de uma vez não duplica o listener.
export function initScoreQueue(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => {
    void drainScoreQueue();
  });

  setTimeout(() => {
    void drainScoreQueue();
  }, INITIAL_DRAIN_DELAY_MS);
}
