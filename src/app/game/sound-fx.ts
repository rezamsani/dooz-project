import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DeviceStorage } from './device-storage';

@Injectable({ providedIn: 'root' })
export class SoundFx {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storage=inject(DeviceStorage);
  private audioCtx: AudioContext | null = null;

  readonly muted = signal<boolean>(false);
  readonly style=signal<'wood'|'soft'|'santur'>('wood');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = this.storage.getItem('dooz_sound_muted');
        const style=this.storage.getItem('dooz_sound_style_v1');
        if(style==='soft'||style==='santur')this.style.set(style);
        if (stored === 'true') {
          this.muted.set(true);
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }

  toggleMute(): void {
    const next = !this.muted();
    this.muted.set(next);
    if (isPlatformBrowser(this.platformId)) {
      try {
        this.storage.setItem('dooz_sound_muted', String(next));
      } catch {
        // Ignore storage restrictions
      }
    }
    if (!next) {
      this.playClick();
    }
  }

  private getContext(): AudioContext | null {
    if (!isPlatformBrowser(this.platformId) || this.muted()) {
      return null;
    }
    if (!this.audioCtx) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        this.audioCtx = new AudioContextCtor();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0,
    endFreq?: number,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Synthesizes a short physical wood-on-wood / stone tabletop clack sound.
   */
  private playTabletopKnock(resonanceHz: number, volume: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Short crisp percussive impact burst (filtered noise)
    const bufferSize = Math.floor(ctx.sampleRate * 0.032);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(resonanceHz * 2.2, now);
    filter.Q.setValueAtTime(2.6, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Warm hollow wooden board body resonance
    this.playTone(resonanceHz, 0.065, 'triangle', volume, 0, resonanceHz * 0.62);
  }

  playMoveX(): void {
    if(this.style()==='soft'){this.playTone(450,.04,'sine',.055);return;}
    if(this.style()==='santur'){this.playTone(587.33,.16,'triangle',.1);this.playTone(1174.66,.09,'sine',.025);return;}
    this.playTabletopKnock(420, 0.2);
  }

  playMoveO(): void {
    if(this.style()==='soft'){this.playTone(340,.04,'sine',.055);return;}
    if(this.style()==='santur'){this.playTone(440,.16,'triangle',.1);this.playTone(880,.09,'sine',.025);return;}
    this.playTabletopKnock(310, 0.2);
  }

  playMill(): void {
    this.playTabletopKnock(480, 0.16);
    this.playTone(587.33, 0.14, 'triangle', 0.14, 0.03);
    this.playTone(880, 0.22, 'triangle', 0.15, 0.11);
  }

  playCapture(): void {
    this.playTabletopKnock(250, 0.22);
    this.playTone(290, 0.11, 'triangle', 0.09, 0.04, 175);
  }

  playWin(): void {
    this.playTone(523.25, 0.16, 'triangle', 0.15, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.15, 0.09);
    this.playTone(783.99, 0.34, 'triangle', 0.17, 0.18);
  }

  playDraw(): void {
    this.playTone(330, 0.13, 'sine', 0.12, 0);
    this.playTone(277.18, 0.22, 'sine', 0.12, 0.12);
  }

  playUndo(): void {
    this.playTone(390, 0.08, 'sine', 0.1, 0, 290);
  }

  playClick(): void {
    this.playTone(520, 0.045, 'sine', 0.07);
  }

  playTick(): void {
    this.playTone(720, 0.03, 'sine', 0.055);
  }

  playHint(): void {
    this.playTone(620, 0.08, 'sine', 0.09, 0, 780);
  }
  setStyle(style:'wood'|'soft'|'santur'):void{this.style.set(style);this.storage.setItem('dooz_sound_style_v1',style);this.playMoveX();}
}
