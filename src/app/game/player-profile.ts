import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { CartoonAvatar, PlayerAvatar, hashGravatarEmail, normalizeAvatar } from './avatar';

const PROFILE_KEY = 'dooz_profile_v1';
@Injectable({ providedIn: 'root' })
export class PlayerProfile {
  private readonly platformId = inject(PLATFORM_ID);
  readonly name = signal('');
  readonly avatar = signal<PlayerAvatar>({ cartoon: 'mint', gravatarHash: null });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
      this.name.set(typeof raw?.name === 'string' ? raw.name.trim().slice(0,18) : '');
      this.avatar.set(normalizeAvatar(raw?.avatar));
    } catch { /* A missing or damaged profile uses the local cartoon. */ }
  }

  setName(name: string): void { this.name.set(name.trim().replace(/\s+/g,' ').slice(0,18)); this.save(); }
  useCartoon(cartoon: CartoonAvatar): void { this.avatar.set(normalizeAvatar({cartoon})); this.save(); }
  useGravatar(email: string): void {
    this.avatar.update(a => ({...a, gravatarHash: hashGravatarEmail(email)}));
    this.save();
  }
  private save(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({name:this.name(),avatar:this.avatar()})); }
    catch { /* The profile still works in memory when storage is unavailable. */ }
  }
}
