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

  // IMPACTO (D-31): não é a morte. Mesmo timbre, mais curto/agudo e mais baixo.
  // Reuso deliberado do sfx-death em vez de um arquivo novo: o vocabulário
  // sonoro do "escândalo" tem de soar PARENTE do da morte (é a mesma família de
  // evento, em intensidade menor), e um sfx novo seria um asset a mais para
  // produzir, otimizar e versionar por um som de 100ms.
  hit(): void {
    this.scene.sound.play('sfx-death', { volume: AUDIO.SFX_VOLUME * 0.55, rate: 1.7 });
  }

  // aprovação recuperada (D-31): parente da fanfarra de linha perfeita, mais agudo
  approval(): void {
    this.scene.sound.play('sfx-combo', { volume: AUDIO.SFX_VOLUME, rate: 1.25 });
  }

  // fanfarra curta do momento "uau" — linha de votos completa (T07A-03)
  combo(): void {
    this.scene.sound.play('sfx-combo', { volume: AUDIO.SFX_VOLUME });
  }

  // brilho da gema rara (T07B-02)
  gem(): void {
    this.scene.sound.play('sfx-gem', { volume: AUDIO.SFX_VOLUME });
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
