import Phaser from 'phaser';

// Base de todas as entidades (design.md §3), com reset()/deactivate()
// para object pooling — nunca new/destroy dentro do game loop (RN-01).
export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  abstract update(time: number, delta: number): void;

  reset(x: number, y: number): void {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).reset(x, y);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).stop();
  }
}
