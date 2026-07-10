import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { Collectible } from '../entities/Collectible';
import { InputSystem } from '../systems/InputSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { BestScoreSystem, type BestRecord } from '../systems/BestScoreSystem';
import { OnboardingSystem } from '../systems/OnboardingSystem';
import { WalletSystem } from '../systems/WalletSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { emitGameEvent, GAME_EVENTS } from '../lib/game-events';
import { CITIES, ECONOMY, JUICE, SCORE, SIZES } from '../config/constants';

const SCORE_EMIT_INTERVAL_MS = 250; // cadência do game:score (D-05) — 60/s seria ruído

// Loop principal (design.md §2). Auto-run world-scroll (RF-04): o Player fica
// em X fixo e o cenário/obstáculos deslizam para a esquerda na velocidade
// corrente. Velocidade fixa neste bloco; ProgressionSystem entra na T04-11.
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private spawner!: SpawnerSystem;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private votes!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private gemText!: Phaser.GameObjects.Text;
  private gemBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private runGems = 0;
  private votesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private score!: ScoreSystem;
  private progression!: ProgressionSystem;
  private audio!: AudioSystem;
  private muteButton!: Phaser.GameObjects.Text;
  private voteBurst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private comboText!: Phaser.GameObjects.Text;
  private comboTween?: Phaser.Tweens.Tween;
  private bestRecord!: BestRecord;
  private recordLine!: Phaser.GameObjects.Rectangle;
  private recordLabel!: Phaser.GameObjects.Text;
  private recordCelebrated = false;
  private onboardingHint?: Phaser.GameObjects.Text;
  private onboardingPulse?: Phaser.Tweens.Tween;
  private cityIndex = 0;
  private cityBanner!: Phaser.GameObjects.Text;
  private currentBg = 0;
  private emitAccumulator = 0;
  private elapsedMs = 0;
  private isGameOver = false;
  private continueUsed = false;
  private invulnerableUntil = 0;
  private continueUi: Phaser.GameObjects.GameObject[] = [];
  private continueTimers: Phaser.Time.TimerEvent[] = [];
  private continueTapHandler?: (p: Phaser.Input.Pointer) => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const groundTop = height - SIZES.GROUND_H;

    // chão = limite inferior do mundo físico; faixa visual rolante dá a
    // sensação de avanço mesmo antes de existirem obstáculos
    this.physics.world.setBounds(0, 0, width, groundTop);
    this.groundTile = this.add.tileSprite(
      width / 2,
      height - SIZES.GROUND_H / 2,
      width,
      SIZES.GROUND_H,
      'ground',
    );

    this.audio = new AudioSystem(this);
    this.player = new Player(this, SIZES.PLAYER.SCREEN_X, groundTop);
    this.inputSystem = new InputSystem(this, this.player, this.audio);

    // pools (RN-01): maxSize limita instâncias; get() reutiliza
    this.obstacles = this.physics.add.group({
      classType: Obstacle,
      maxSize: 24,
      runChildUpdate: true,
    });
    this.votes = this.physics.add.group({
      classType: Collectible,
      maxSize: 36,
      runChildUpdate: true,
    });
    this.gems = this.physics.add.group({
      classType: Collectible,
      maxSize: 4, // no máx. 2 por partida (ECONOMY.GEM_WINDOWS_M) + folga
      runChildUpdate: true,
    });
    this.spawner = new SpawnerSystem(this, this.obstacles, this.votes, this.gems);

    // RF-07: qualquer contato com obstáculo encerra a partida
    this.physics.add.overlap(this.player, this.obstacles, (_p, o) =>
      this.gameOver(o as Obstacle),
    );
    // RF-11: coletar voto incrementa o contador do HUD
    this.physics.add.overlap(this.player, this.votes, (_p, v) =>
      this.collectVote(v as Collectible),
    );
    // T07B-02: gema rara → carteira persistente
    this.physics.add.overlap(this.player, this.gems, (_p, g) =>
      this.collectGem(g as Collectible),
    );

    // emitter ÚNICO criado fora do loop; explode() reutiliza partículas do
    // pool interno do Phaser (RN-01 — nada de new/destroy por coleta)
    this.voteBurst = this.add.particles(0, 0, 'vote', {
      emitting: false,
      lifespan: JUICE.VOTE_BURST_LIFESPAN_MS,
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 }, // leque pra cima (o mundo corre pra esquerda)
      gravityY: 600,
      scale: { start: 0.7, end: 0 },
      quantity: JUICE.VOTE_BURST_COUNT,
    });
    this.voteBurst.setDepth(5);
    this.gemBurst = this.add.particles(0, 0, 'gem', {
      emitting: false,
      lifespan: 450,
      speed: { min: 100, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 500,
      scale: { start: 0.8, end: 0 },
      rotate: { min: 0, max: 360 },
      quantity: 14,
    });
    this.gemBurst.setDepth(5);
    this.runGems = 0;

    this.score = new ScoreSystem();
    this.createHud(width);
    this.bestRecord = BestScoreSystem.load();
    this.recordCelebrated = false;
    this.createRecordMarker();
    this.createOnboardingHint();
    this.cityIndex = 0;
    this.applyCityPalette(0, false); // largada em São Paulo (D-14)
    this.audio.startMusic();
    this.cameras.main.fadeIn(JUICE.FADE_IN_MS, 0, 0, 0);

    this.progression = new ProgressionSystem();
    this.emitAccumulator = 0;
    this.elapsedMs = 0;
    this.isGameOver = false;
    this.continueUsed = false;
    this.invulnerableUntil = 0;
  }

  // HUD (RF-03/T04-12): score, votos e distância sempre visíveis, fora da
  // área de ação do polegar (RN-02)
  private createHud(width: number): void {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' };
    this.scoreText = this.add
      .text(width / 2, 10, 'SCORE 0', { ...style, fontSize: '20px' })
      .setOrigin(0.5, 0)
      .setDepth(10);
    this.votesText = this.add
      .text(width - 12, 10, 'VOTOS 0', { ...style, color: '#facc15' })
      .setOrigin(1, 0)
      .setDepth(10);
    // carteira de gemas (T07B-02): saldo TOTAL do aparelho, não só da run
    this.gemText = this.add
      .text(width - 12, 32, `💎 ${WalletSystem.balance()}`, { ...style, color: '#c084fc' })
      .setOrigin(1, 0)
      .setDepth(10);
    this.distanceText = this.add
      .text(12, 10, '0m', { ...style, color: '#94a3b8' })
      .setOrigin(0, 0)
      .setDepth(10);

    // mute (T05-06/RN-02): canto oposto ao botão "← Menu" do shell React,
    // fora da área de ação do polegar
    // texto flutuante do combo (T07A-03): UM objeto reutilizado por tween —
    // nada de criar/destruir texto dentro do loop (RN-01)
    this.comboText = this.add
      .text(0, 0, `LINHA PERFEITA! +${SCORE.LINE_BONUS_VOTES * SCORE.VOTE_POINTS}`, {
        ...style,
        fontSize: '18px',
        color: '#facc15',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    // banner de chegada em cidade (T07B-01): um objeto reutilizado
    this.cityBanner = this.add
      .text(width / 2, this.scale.height * 0.42, '', {
        ...style,
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);

    this.muteButton = this.add
      .text(width - 12, this.scale.height - 10, this.sound.mute ? '🔇' : '🔊', {
        ...style,
        fontSize: '22px',
      })
      .setOrigin(1, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const muted = this.audio.toggleMute();
        this.muteButton.setText(muted ? '🔇' : '🔊');
      });
  }

  private updateHud(): void {
    const snap = this.score.getSnapshot();
    this.scoreText.setText(`SCORE ${snap.score}`);
    this.distanceText.setText(`${snap.distance}m`);
    // votesText atualiza em collectVote (evento raro, não a cada frame)
  }

  private collectVote(vote: Collectible): void {
    const { x, y } = vote;
    const lineComplete = this.spawner.onVoteCollected(vote); // antes do deactivate
    vote.deactivate(); // pooling: nunca destroy (RN-01)
    this.score.addVote();
    this.audio.vote();
    this.voteBurst.explode(JUICE.VOTE_BURST_COUNT, x, y); // T07A-02
    if (lineComplete) this.celebrateLine(x, y); // momento "uau" (T07A-03)
    this.votesText.setText(`VOTOS ${this.score.getSnapshot().votes}`);
  }

  // gema rara (T07B-02, D-11): vai DIRETO pra carteira persistente — mesmo
  // morrendo, a run deixou algo pra trás ("mesmo assim avancei")
  private collectGem(gem: Collectible): void {
    const { x, y } = gem;
    gem.deactivate();
    this.runGems += 1;
    const balance = WalletSystem.add(1);
    this.gemText.setText(`💎 ${balance}`);
    this.audio.gem();
    this.gemBurst.explode(14, x, y);
    this.showFloatingText(x, y - 24, 'GEMA RARA! 💎');
  }

  // linha inteira coletada: bônus (em votos — ver SCORE.LINE_BONUS_VOTES),
  // fanfarra, explosão maior e texto flutuante
  private celebrateLine(x: number, y: number): void {
    this.score.addLineBonus();
    this.audio.combo();
    this.voteBurst.explode(JUICE.COMBO_BURST_COUNT, x, y);
    this.showFloatingText(x, y - 24, `LINHA PERFEITA! +${SCORE.LINE_BONUS_VOTES * SCORE.VOTE_POINTS}`);
  }

  // texto flutuante compartilhado (combo, novo recorde): UM objeto, um tween
  private showFloatingText(x: number, y: number, msg: string): void {
    this.comboTween?.stop();
    this.comboText.setText(msg).setPosition(x, y).setAlpha(1).setVisible(true);
    this.comboTween = this.tweens.add({
      targets: this.comboText,
      y: y - 48,
      alpha: 0,
      duration: JUICE.COMBO_TEXT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => this.comboText.setVisible(false),
    });
  }

  // Marcador do recorde pessoal na pista (T07A-04, D-10): a "linha de
  // chegada" do seu melhor run se aproxima — quase-vitória visível, sem
  // mexer em dificuldade. Invisível na primeira partida (sem recorde).
  private createRecordMarker(): void {
    const groundTop = this.scale.height - SIZES.GROUND_H;
    this.recordLine = this.add
      .rectangle(0, groundTop, 3, 140, 0xfacc15, 0.7)
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
    this.recordLabel = this.add
      .text(0, groundTop - 146, '🏁 RECORDE', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#facc15',
      })
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setVisible(false);
  }

  // Micro-onboarding (T07A-06, RF-15): hint de controles UMA vez por
  // aparelho, mínimo e não-bloqueante. Some na 1ª interação (o jogador agiu
  // = entendeu) ou sozinho após 6s. FIRST_GAP + aquecimento (T07A-05) dão o
  // respiro de leitura antes do 1º obstáculo. Critério: entender em ≤5s.
  private createOnboardingHint(): void {
    if (OnboardingSystem.isDone()) return;
    const touch = this.sys.game.device.input.touch;
    const lines = touch
      ? 'TOQUE = pular\nSEGURE = pular mais alto\nDESLIZE ↓ = escorregar'
      : 'ESPAÇO ou ↑ = pular\nSEGURE = pular mais alto\n↓ = deslizar';
    this.onboardingHint = this.add
      .text(this.scale.width / 2, this.scale.height * 0.3, lines, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#0f172abf',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.onboardingPulse = this.tweens.add({
      targets: this.onboardingHint,
      alpha: 0.75,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.once('pointerdown', () => this.dismissOnboarding(900));
    this.input.keyboard?.once('keydown', () => this.dismissOnboarding(900));
    this.time.delayedCall(6000, () => this.dismissOnboarding(500));
  }

  private dismissOnboarding(fadeMs: number): void {
    if (!this.onboardingHint) return;
    const hint = this.onboardingHint;
    this.onboardingHint = undefined; // idempotente (toque + timer)
    this.onboardingPulse?.stop();
    OnboardingSystem.markDone();
    this.tweens.add({
      targets: hint,
      alpha: 0,
      duration: fadeMs,
      onComplete: () => hint.setVisible(false),
    });
  }

  // Cidades da campanha (T07B-01, D-14): marcos de distância trocam a
  // ATMOSFERA (fundo, chão, tint sutil dos obstáculos) — nunca a silhueta.
  // Progresso visível e objetivo de médio prazo ("chegar em Brasília").
  private updateCityProgress(): void {
    const next = CITIES[this.cityIndex + 1];
    if (!next || this.score.getSnapshot().distance < next.atDistanceM) return;
    this.cityIndex += 1;
    this.applyCityPalette(this.cityIndex, true);
    this.announceCity(next.name);
  }

  private applyCityPalette(index: number, animate: boolean): void {
    const city = CITIES[index];
    this.groundTile.setTint(city.groundTint);
    this.spawner.setObstacleTint(city.obstacleTint);
    // retinta os obstáculos já em tela — consistência imediata da paleta
    this.obstacles.children.iterate((child) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) sprite.setTint(city.obstacleTint);
      return true;
    });

    if (!animate) {
      this.currentBg = city.bg;
      this.cameras.main.setBackgroundColor(city.bg);
      return;
    }
    const fromColor = Phaser.Display.Color.ValueToColor(this.currentBg);
    const toColor = Phaser.Display.Color.ValueToColor(city.bg);
    this.currentBg = city.bg;
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 900,
      onUpdate: (tw) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          fromColor,
          toColor,
          100,
          tw.getValue() ?? 0,
        );
        this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
  }

  private announceCity(name: string): void {
    this.audio.combo();
    this.cityBanner
      .setText(`🏙️ Você chegou em ${name}!`)
      .setAlpha(0)
      .setScale(0.8)
      .setVisible(true);
    this.tweens.add({
      targets: this.cityBanner,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.cityBanner,
          alpha: 0,
          delay: 1400,
          duration: 500,
          onComplete: () => this.cityBanner.setVisible(false),
        });
      },
    });
  }

  private updateRecordMarker(): void {
    if (this.bestRecord.distance <= 0) return; // primeira partida: sem marcador
    const bestPx = this.bestRecord.distance * SCORE.PX_PER_M;
    const x = SIZES.PLAYER.SCREEN_X + (bestPx - this.score.getDistancePx());
    const visible = x > -24 && x < this.scale.width + 48;
    this.recordLine.setVisible(visible).setX(x);
    this.recordLabel.setVisible(visible).setX(x);

    // texto diz DISTÂNCIA de propósito: o "recorde" oficial (game over e
    // ranking) é por SCORE — celebrar "NOVO RECORDE!" aqui contradiria a
    // tela de morte quando a distância cresce mas o score não (review 7A)
    if (!this.recordCelebrated && this.score.getDistancePx() > bestPx) {
      this.recordCelebrated = true; // 1x por partida
      this.audio.combo();
      this.showFloatingText(
        SIZES.PLAYER.SCREEN_X + 70,
        this.scale.height * 0.35,
        'DISTÂNCIA RECORDE!',
      );
    }
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) return;
    this.elapsedMs += delta;
    this.inputSystem.update();
    this.progression.update(delta); // dificuldade crescente (RF-09)
    const speed = this.progression.speed;
    const step = (speed * delta) / 1000;
    this.groundTile.tilePositionX += step;
    this.score.addDistance(step); // pontos por distância/tempo (RF-08)
    this.spawner.update(this.progression.distance, speed);
    this.syncWorldSpeed(speed);
    this.player.update(time, delta);
    this.updateHud();
    this.updateRecordMarker();
    this.updateCityProgress();

    // contrato D-05: score periódico para o shell React (throttled)
    this.emitAccumulator += delta;
    if (this.emitAccumulator >= SCORE_EMIT_INTERVAL_MS) {
      this.emitAccumulator = 0;
      emitGameEvent(GAME_EVENTS.SCORE, this.score.getSnapshot());
    }
  }

  // mantém obstáculos/votos já spawnados na MESMA velocidade do chão quando
  // a progressão acelera — sem isso o mundo "rasga" a cada degrau de speed
  private syncWorldSpeed(speed: number): void {
    const sync = (child: Phaser.GameObjects.GameObject): boolean => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) sprite.setVelocityX(-speed);
      return true;
    };
    this.obstacles.children.iterate(sync);
    this.votes.children.iterate(sync);
    this.gems.children.iterate(sync);
  }

  // RF-07: morte. Com saldo e continue ainda não usado, abre a oferta
  // arcade (T07B-03) ANTES de finalizar — o game:gameover (e o submit de
  // score) só acontecem na morte definitiva.
  private gameOver(killer?: Obstacle): void {
    if (this.isGameOver) return;
    if (this.time.now < this.invulnerableUntil) return; // carência pós-revive
    this.isGameOver = true;
    this.physics.pause();
    this.inputSystem.setEnabled(false);
    this.player.setTint(0x94a3b8);
    this.audio.death();
    // impacto legível (T07A-02): shake + flash curtos — morte "registra"
    this.cameras.main.shake(JUICE.SHAKE_DURATION_MS, JUICE.SHAKE_INTENSITY);
    this.cameras.main.flash(JUICE.FLASH_DURATION_MS, 239, 68, 68);

    const canContinue =
      !this.continueUsed && WalletSystem.balance() >= ECONOMY.CONTINUE_COST;
    if (canContinue) {
      this.time.delayedCall(500, () => this.offerContinue(killer)); // beat da morte
      return;
    }
    this.finalizeGameOver(killer);
  }

  // Oferta de continue (T07B-03, D-11): botão tremendo + countdown. Aceitar
  // gasta gemas e revive no lugar; recusar/estourar o tempo finaliza.
  private offerContinue(killer?: Obstacle): void {
    const { width, height } = this.scale;
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setDepth(20);
    const btn = this.add
      .text(width / 2, height * 0.45, `▶ CONTINUE — ${ECONOMY.CONTINUE_COST} 💎`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#0f172a',
        backgroundColor: '#facc15',
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(21);
    const countdown = this.add
      .text(width / 2, height * 0.56, `some em ${ECONOMY.CONTINUE_OFFER_SEC}s…`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.continueUi = [dim, btn, countdown];

    // "tremida rápida a cada 0.5s" (pedido do dono no brainstorm)
    this.tweens.add({
      targets: btn,
      x: '+=4',
      duration: 50,
      yoyo: true,
      repeat: -1,
      repeatDelay: 450,
    });

    let remaining = ECONOMY.CONTINUE_OFFER_SEC;
    this.continueTimers = [
      this.time.addEvent({
        delay: 1000,
        repeat: ECONOMY.CONTINUE_OFFER_SEC - 1,
        callback: () => {
          remaining -= 1;
          countdown.setText(`some em ${remaining}s…`);
        },
      }),
      this.time.delayedCall(ECONOMY.CONTINUE_OFFER_SEC * 1000, () => {
        this.closeContinueOffer();
        this.finalizeGameOver(killer);
      }),
    ];

    // Aceite via pointerdown de CENA + bounds do botão (mesmo pipeline dos
    // pulos, que é comprovado em mouse E touch) — o hit-test por GameObject
    // falhou com mouse no harness. Bounds inflados p/ dedo no mobile (RN-02).
    // Toque FORA do botão é ignorado: recusar é só deixar o tempo estourar.
    const onTap = (p: Phaser.Input.Pointer): void => {
      const hitArea = Phaser.Geom.Rectangle.Inflate(btn.getBounds(), 16, 16);
      if (!hitArea.contains(p.x, p.y)) return;
      this.input.off('pointerdown', onTap);
      this.closeContinueOffer();
      if (!WalletSystem.spend(ECONOMY.CONTINUE_COST)) {
        this.finalizeGameOver(killer);
        return;
      }
      this.revive();
    };
    this.input.on('pointerdown', onTap);
    this.continueTapHandler = onTap;
  }

  private closeContinueOffer(): void {
    if (this.continueTapHandler) {
      this.input.off('pointerdown', this.continueTapHandler);
      this.continueTapHandler = undefined;
    }
    this.continueTimers.forEach((t) => t.remove());
    this.continueTimers = [];
    this.continueUi.forEach((o) => o.destroy()); // fora do game loop — ok (RN-01)
    this.continueUi = [];
  }

  private revive(): void {
    this.continueUsed = true; // 1x por partida
    this.gemText.setText(`💎 ${WalletSystem.balance()}`);
    // pista limpa à frente: revive nunca pode ser morte instantânea injusta
    this.obstacles.children.iterate((child) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) (sprite as Obstacle).deactivate();
      return true;
    });
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.stop();
    this.player.clearTint();
    this.audio.gem();
    this.isGameOver = false;
    this.physics.resume();
    this.inputSystem.setEnabled(true);
    // carência com blink: invencível por 1.5s para reentrar no flow
    this.invulnerableUntil = this.time.now + 1500;
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 140,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.setAlpha(1),
    });
    // elapsedMs NÃO andou durante a oferta (update retorna cedo no game
    // over) — o teto de plausibilidade da Edge Function segue coerente
  }

  // contrato D-05: emite game:gameover (submit de score) e vai à GameOverScene
  private finalizeGameOver(killer?: Obstacle): void {
    const snapshot = this.score.getSnapshot();
    // elapsedSec (T05-04): a Edge Function submit-score usa pra teto de
    // plausibilidade (RN-04) — não faz parte do ScoreSnapshot em si.
    const elapsedSec = this.elapsedMs / 1000;
    // deathCause (T07A-05): telemetria de onde/como se morre — calibra a
    // curva fixa com dados reais (D-10). Sem killer identificado → 'unknown',
    // nunca um palpite que polua a calibração.
    const deathCause = killer
      ? killer.getData('kind') === 'low'
        ? ('obstacle-low' as const)
        : ('obstacle-high' as const)
      : ('unknown' as const);
    emitGameEvent(GAME_EVENTS.GAME_OVER, {
      ...snapshot,
      elapsedSec,
      deathCause,
      gems: this.runGems, // T07B-02: gemas desta run (pop-up 7C + telemetria)
    });

    // quase-vitória (T07A-04): salva os novos máximos e leva o recorde
    // ANTERIOR para a GameOverScene calcular o "faltaram Xm"
    const prevBest = BestScoreSystem.update(snapshot);
    const gameOverData = {
      ...snapshot,
      newBestScore: snapshot.score > prevBest.score,
      tiedRecord: prevBest.score > 0 && snapshot.score === prevBest.score,
      distanceGapM: Math.max(0, prevBest.distance - snapshot.distance),
      scoreGap: Math.max(0, prevBest.score - snapshot.score),
    };
    // beat curto para a morte "registrar" antes da troca de tela
    this.time.delayedCall(450, () => this.scene.start('GameOverScene', gameOverData));
  }
}
