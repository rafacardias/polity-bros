import Phaser from 'phaser';
import { FINISH_CLEAR_M, SCORE, SIZES, TERRAIN } from '../config/constants';

// Segmento de terreno em coordenada de MUNDO (px de distância percorrida). O
// mundo rola para a esquerda: um ponto de mundo D fica na tela em
// screenX = SCREEN_X + (D - distanceAtual). Cada segmento é um trecho PLANO de
// um nível (0 = base). A transição de nível é o "degrau".
interface Segment {
  startX: number; // borda esquerda no mundo (px)
  w: number; // comprimento (px)
  level: number; // 0..MAX_LEVEL — altura = level * STEP_H acima da base
}

// TerrainSystem (D-26, §4.1): gera e desenha um chão em degraus NÃO-LETAL. A
// física é resolvida por um corpo-chão invisível na GameScene, que pergunta
// aqui a altura sob o player a cada frame (groundOffsetAt). Layout FIXO por
// mundo via RNG semeado próprio (D-16) — independente do RNG do SpawnerSystem
// para não deslocar a sequência de obstáculos/inimigos.
export class TerrainSystem {
  private segments: Segment[] = [];
  private genWorldX = 0; // mundo já gerado até aqui (borda direita do último segmento)
  private prevLevel = 0;
  private readonly groundTop: number;
  private readonly sceneBottom: number;
  private readonly playableEndPx: number;
  private tint = 0xffffff;

  constructor(
    private scene: Phaser.Scene,
    private rng: Phaser.Math.RandomDataGenerator,
    worldLengthPx: number,
    private gfx: Phaser.GameObjects.Graphics,
  ) {
    this.groundTop = scene.scale.height - SIZES.GROUND_H;
    this.sceneBottom = scene.scale.height;
    // fim jogável: depois disso o terreno volta à base (reta de chegada PLANA,
    // par do FINISH_CLEAR do SpawnerSystem — a vitória se celebra em chão limpo,
    // e a linha de chegada/marcadores ficam alinhados com a base)
    this.playableEndPx = worldLengthPx - FINISH_CLEAR_M * SCORE.PX_PER_M;
  }

  // paleta do mundo (D-16): o topo do degrau acompanha o tint do chão
  setTint(tint: number): void {
    this.tint = tint;
  }

  // Gera segmentos à frente do player conforme o mundo avança, mantendo o
  // buffer coberto para além da borda direita da tela. Determinístico: a
  // SEQUÊNCIA de larguras/níveis vem do rng semeado; as posições de mundo
  // encadeiam por largura — logo o layout é idêntico em toda partida (D-16).
  private generateAhead(distance: number): void {
    const aheadTarget = distance + this.scene.scale.width + TERRAIN.SEG_MAX;
    while (this.genWorldX < aheadTarget) {
      const startX = this.genWorldX;
      let w: number;
      let level: number;
      if (startX < TERRAIN.WARMUP_FLAT_PX) {
        // largada plana: um único segmento base até o fim do aquecimento
        w = TERRAIN.WARMUP_FLAT_PX - startX;
        level = 0;
      } else if (startX >= this.playableEndPx) {
        // reta de chegada: base plana até o fim (segmento longo)
        w = TERRAIN.SEG_MAX;
        level = 0;
      } else {
        w = this.rng.between(TERRAIN.SEG_MIN, TERRAIN.SEG_MAX);
        // passeio aleatório de nível: sobe/desce/mantém 1 nível por vez, limitado
        // a 0..MAX_LEVEL. pick uniforme sobre {-1,0,+1} → nunca um salto de 2
        // níveis de uma vez (parede impossível não existe — §7-A auto-climb).
        const delta = this.rng.pick([-1, 0, 1]);
        level = Phaser.Math.Clamp(this.prevLevel + delta, 0, TERRAIN.MAX_LEVEL);
      }
      this.segments.push({ startX, w, level });
      this.prevLevel = level;
      this.genWorldX += w;
    }
  }

  // Recicla segmentos que já saíram pela esquerda (borda direita atrás do player)
  private recycleBehind(distance: number): void {
    const cullX = distance - SIZES.PLAYER.SCREEN_X - 2 * TERRAIN.SEG_MAX;
    let removed = 0;
    for (const seg of this.segments) {
      if (seg.startX + seg.w < cullX) removed++;
      else break;
    }
    if (removed > 0) this.segments.splice(0, removed);
  }

  // Altura (offset em px acima da base) do terreno numa posição de MUNDO.
  // 0 = base. Usado pela GameScene para posicionar o corpo-chão sob o player
  // e pelo SpawnerSystem para assentar entidades no degrau (não flutuar).
  groundOffsetAt(worldX: number): number {
    for (const seg of this.segments) {
      if (worldX >= seg.startX && worldX < seg.startX + seg.w) {
        return seg.level * TERRAIN.STEP_H;
      }
    }
    return 0; // fora do gerado (base)
  }

  // Avança o terreno e redesenha a silhueta. distance = mundo do player (px).
  update(distance: number): void {
    this.generateAhead(distance);
    this.recycleBehind(distance);
    this.draw(distance);
  }

  // Redesenha a silhueta dos degraus (nível > 0) em UM Graphics reutilizado
  // (clear + fillRect — sem new/destroy no loop, RN-01). Base (nível 0) já é
  // coberta pelo groundTile plano; aqui só os trechos elevados.
  private draw(distance: number): void {
    const g = this.gfx;
    g.clear();
    const screenW = this.scene.scale.width;
    // cores do chão (par de generateGroundTexture) moduladas pelo tint do mundo
    const bodyC = this.applyTint(0x3f3f46);
    const faceC = this.applyTint(0x71717a);
    for (const seg of this.segments) {
      if (seg.level <= 0) continue;
      const left = SIZES.PLAYER.SCREEN_X + (seg.startX - distance);
      if (left + seg.w < -2 || left > screenW + 2) continue; // fora da tela
      const top = this.groundTop - seg.level * TERRAIN.STEP_H;
      // corpo do degrau (do topo até o fundo da tela)
      g.fillStyle(bodyC, 1);
      g.fillRect(left, top, seg.w, this.sceneBottom - top);
      // faixa de topo (leitura de "superfície")
      g.fillStyle(faceC, 1);
      g.fillRect(left, top, seg.w, 6);
    }
  }

  // multiplica uma cor RGB por um tint (mesma conta do tint de textura do Phaser)
  private applyTint(base: number): number {
    const t = this.tint;
    const r = (((base >> 16) & 0xff) * ((t >> 16) & 0xff)) / 255;
    const gg = (((base >> 8) & 0xff) * ((t >> 8) & 0xff)) / 255;
    const b = ((base & 0xff) * (t & 0xff)) / 255;
    return Phaser.Display.Color.GetColor(r, gg, b);
  }

  // distância → mundo do próximo obstáculo/inimigo que nasce na borda direita:
  // o SpawnerSystem usa para assentar a entidade no degrau correspondente.
  worldXAtScreenRight(distance: number): number {
    return distance + this.scene.scale.width - SIZES.PLAYER.SCREEN_X;
  }

  // conversão px→m só para logs/afinação; não usada no hot path
  static pxToM(px: number): number {
    return px / SCORE.PX_PER_M;
  }
}
