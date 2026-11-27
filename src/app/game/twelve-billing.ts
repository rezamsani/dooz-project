import { isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface TwelveStoreStatus {
  store: 'standalone' | 'myket' | 'bazaar';
  configured: boolean;
  owned: boolean;
  price?: string;
}

interface TwelveBillingPlugin {
  getStatus(): Promise<TwelveStoreStatus>;
  getOffer(): Promise<TwelveStoreStatus>;
  restore(): Promise<TwelveStoreStatus>;
  purchase(): Promise<TwelveStoreStatus>;
}

const plugin = registerPlugin<TwelveBillingPlugin>('DoozBilling');
export const NATIVE_TWELVE_BILLING = new InjectionToken<TwelveBillingPlugin | null>('Android store billing', {
  providedIn: 'root',
  factory: () => isPlatformBrowser(inject(PLATFORM_ID)) && Capacitor.getPlatform() === 'android' ? plugin : null,
});

type Operation = 'getOffer' | 'restore' | 'purchase';

@Injectable({ providedIn: 'root' })
export class TwelveBilling {
  private readonly native = inject(NATIVE_TWELVE_BILLING);
  readonly status = signal<TwelveStoreStatus | null>(null);
  readonly busy = signal<Operation | 'loading' | null>(null);
  readonly message = signal('');
  readonly price = signal<string | null>(null);
  readonly canPlay = computed(() => !!this.native && !!this.status()?.owned);
  readonly storeName = computed(() => this.status()?.store === 'myket' ? 'مایکت' : this.status()?.store === 'bazaar' ? 'بازار' : 'فروشگاه');
  readonly ready = this.native ? this.loadStatus(this.native) : Promise.resolve();

  readonly storefrontRequired = computed(() => !this.native || this.status()?.store === 'standalone');

  constructor() {
    if (this.native) void this.ready.then(() => {
      if (this.status()?.owned) void this.run('restore', true);
    });
  }

  prepareOffer(): void {
    this.ready.then(() => {
      if (!this.canPlay() && !this.price()) void this.run('getOffer');
    });
  }

  purchase(): Promise<void> {
    return this.run('purchase');
  }

  restore(): Promise<void> {
    return this.run('restore');
  }

  private async loadStatus(native: TwelveBillingPlugin): Promise<void> {
    this.busy.set('loading');
    try {
      this.status.set(await native.getStatus());
    } catch {
      this.message.set('اتصال به پرداخت فروشگاه برقرار نشد.');
    } finally {
      this.busy.set(null);
    }
  }

  private async run(operation: Operation, background = false): Promise<void> {
    if (!this.native || !this.status()?.configured || this.busy() || (!background && this.canPlay())) return;
    this.busy.set(operation);
    this.message.set('');
    try {
      const status = await this.native[operation]();
      this.status.set(status);
      if (status.price) this.price.set(status.price);
      if (!background && operation === 'restore' && !status.owned) this.message.set('خریدی برای دوز ۱۲ تایی در این حساب پیدا نشد.');
    } catch (error) {
      if (background) return;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      this.message.set(code === 'CANCELED'
        ? 'خرید لغو شد.'
        : 'اتصال به پرداخت فروشگاه برقرار نشد.');
    } finally {
      this.busy.set(null);
    }
  }
}
