import Phaser from 'phaser';
import { AUDIO } from '../config/constants';

const MUTE_STORAGE_KEY = 'polity-bros:muted';

// SFX + música (RF-10). O desbloqueio de autoplay é automático: o
// WebAudioSoundManager do Phaser já espera o 1º gesto do usuário (o próprio
// tap em "Jogar" no menu) antes de tocar qualquer som — nada especial a fazer
// aqui além de usar this.scene.sound normalmente.
export class AudioSystem {
  constructor(private scene: Phaser.Scene) {
    this.scene.sound.mute = AudioSystem.isMuted();
  }

  jump(): void {
    this.scene.sound.play('sfx-jump', { volume: AUDIO.SFX_VOLUME });
  }

  vote(): void {
    this.scene.sound.play('sfx-vote', { volume: AUDIO.SFX_VOLUME });
  }

  death(): void {
    this.scene.sound.play('sfx-death', { volume: AUDIO.SFX_VOLUME });
  }

  startMusic(): void {
    if (this.scene.sound.get('music')) return; // já tocando (restart de cena)
    this.scene.sound.play('music', { loop: true, volume: AUDIO.MUSIC_VOLUME });
  }

  toggleMute(): boolean {
    const muted = !this.scene.sound.mute;
    this.scene.sound.mute = muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    return muted;
  }

  static isMuted(): boolean {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  }
}
