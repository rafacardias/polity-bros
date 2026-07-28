// Frame final da última partida (T07D-04, D-12), para a imagem de share.
//
// Por que isto existe fora do payload do game:gameover: `renderer.snapshot()`
// é ASSÍNCRONO e resolve só no próximo passo de render. Na VITÓRIA sobra
// tempo (finalizeGameOver só roda ~1500ms depois da captura), mas na DERROTA
// o gameover é emitido no mesmo tick da captura — então `payload.screenshot`
// saía `undefined` e a imagem de compartilhamento vinha com fundo preto.
//
// Adiar o game:gameover para esperar o snapshot seria pior: atrasaria o
// submit do score e o replay em 1 toque (RN-03). Como o jogador só clica em
// "Compartilhar" segundos depois da morte, basta guardar o frame aqui e deixar
// o React lê-lo na hora do clique, quando já resolveu há muito.
let lastScreenshot: string | undefined;

export function setLastScreenshot(dataUrl: string | undefined): void {
  lastScreenshot = dataUrl;
}

// dataURL PNG do frame final, ou undefined se a captura falhou/não resolveu.
// Quem chama trata a ausência como caso normal (a imagem sai com fundo sólido).
export function getLastScreenshot(): string | undefined {
  return lastScreenshot;
}
