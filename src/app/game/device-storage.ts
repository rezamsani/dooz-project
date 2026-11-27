import { isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KEYS = [
  'dooz_language_v1',
  'dooz_player_stats_v1', 'dooz_profile_v1', 'dooz_board_theme_v1', 'dooz_color_mode_v1',
  'dooz_environment_theme_v1', 'dooz_piece_style_v1', 'dooz_view_mode_v1',
  'dooz_custom_x_color_v1', 'dooz_custom_o_color_v1', 'dooz_custom_board_color_v1',
  'dooz_journey_v1', 'dooz_online_session_v1', 'dooz_sound_muted', 'dooz_sound_style_v1', 'dooz_ai_starter_v1',
];
export const NATIVE_STORAGE = new InjectionToken<boolean>('native player storage',{providedIn:'root',factory:()=>Capacitor.isNativePlatform()});
type NativePreferences = Pick<typeof Preferences, 'get' | 'set' | 'remove'>;
export const NATIVE_PREFERENCES = new InjectionToken<NativePreferences>('native preferences', {
  providedIn: 'root',
  factory: () => ({
    get: (options) => Preferences.get(options),
    set: (options) => Preferences.set(options),
    remove: (options) => Preferences.remove(options),
  }),
});

@Injectable({providedIn:'root'})
export class DeviceStorage {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly preferences = inject(NATIVE_PREFERENCES);
  readonly native = inject(NATIVE_STORAGE);
  readonly issue = signal<'load' | 'write' | null>(null);
  readonly pending = signal(0);
  private readonly cache = new Map<string,string>();
  private readonly dirty = new Map<string,string | null>();
  private readonly unread = new Set<string>();
  private queue = Promise.resolve();

  // The app initializer awaits this before constructing stats/profile services.
  async load(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.native) return;
    await Promise.all(KEYS.map(async key => {
      try {
        let {value} = await this.preferences.get({key});
        if (value === null) {
          try { value = window.localStorage.getItem(key); } catch { /* No legacy data. */ }
          if (value !== null) await this.preferences.set({key,value});
        }
        if (value !== null) this.cache.set(key,value);
      } catch {
        this.unread.add(key);
        this.issue.set('load');
      }
    }));
  }

  getItem(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    if (this.native) return this.cache.get(key) ?? null;
    try { return window.localStorage.getItem(key); }
    catch { this.unread.add(key); this.issue.set('load'); return null; }
  }

  canReadStats(): boolean { return !this.unread.has('dooz_player_stats_v1'); }

  setItem(key: string, value: string): void { this.write(key,value); }
  removeItem(key: string): void { this.write(key,null); }
  private write(key: string, value: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.unread.has(key)) return; // Never overwrite a record we could not read.
    if (value === null) this.cache.delete(key); else this.cache.set(key,value);
    this.dirty.set(key,value);
    if (!this.native) {
      try {
        if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key,value);
        this.dirty.delete(key);
        if (!this.unread.size && !this.dirty.size) this.issue.set(null);
      } catch { this.issue.set('write'); }
      return;
    }
    this.pending.update(n=>n+1);
    // Serialize writes so an older result cannot finish after a newer one.
    this.queue = this.queue.then(async () => {
      try {
        if (value === null) await this.preferences.remove({key}); else await this.preferences.set({key,value});
        if (this.dirty.get(key) === value) this.dirty.delete(key);
        if (!this.unread.size && !this.dirty.size) this.issue.set(null);
      } catch { this.issue.set('write'); }
      finally { this.pending.update(n=>n-1); }
    });
  }

  async flush(): Promise<void> { await this.queue; }
  retry(): void { for (const [key,value] of this.dirty) this.write(key,value); }
}
