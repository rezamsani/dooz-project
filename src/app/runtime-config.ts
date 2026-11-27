import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export function serverOrigin(value: unknown, requireHttps = false): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Server URL must be a string');
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    (requireHttps && url.protocol !== 'https:') ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/'
  ) {
    throw new Error('Use a server origin such as https://play.example.com');
  }
  return url.origin;
}

export function onlineSocketUrl(server: string | null, pageOrigin: string, native: boolean): string | null {
  if (!server && native) return null;
  const url = new URL('/api/ws', server ?? pageOrigin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfig {
  private readonly platformId = inject(PLATFORM_ID);
  readonly isNative = Capacitor.isNativePlatform();
  private onlineServer: string | null = null;
  private publicWeb: string | null = null;

  async load(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const response = await fetch('/runtime-config.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Runtime configuration unavailable');
      const config = await response.json() as { onlineServerUrl?: unknown; publicWebUrl?: unknown };
      const onlineServer = serverOrigin(config.onlineServerUrl, this.isNative);
      const publicWeb = serverOrigin(config.publicWebUrl, this.isNative);
      this.onlineServer = onlineServer;
      this.publicWeb = publicWeb;
    } catch (error) {
      // Local play stays available even if online configuration cannot be loaded.
      console.warn('Online configuration unavailable', error);
    }
  }

  get socketUrl(): string | null {
    return onlineSocketUrl(this.onlineServer, window.location.origin, this.isNative);
  }

  inviteLink(code: string): string | null {
    const origin = this.publicWeb ?? (this.isNative ? null : window.location.origin);
    if (!origin) return null;
    const url = new URL('/', origin);
    url.searchParams.set('room', code);
    return url.href;
  }

  challengeLink(date:string):string|null{
    const origin=this.publicWeb??(this.isNative?null:window.location.origin);
    if(!origin)return null;
    const url=new URL('/',origin);url.searchParams.set('puzzle',date);return url.href;
  }
}
