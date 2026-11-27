import { DOCUMENT } from '@angular/common';
import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';
import { DeviceStorage } from './game/device-storage';

export type Language = 'fa' | 'en' | 'ar';
const LANGUAGE_KEY = 'dooz_language_v1';
const TITLES: Record<Language, string> = {
  fa: 'دوز — بازی فکری کلاسیک',
  en: 'Dooz — Classic Strategy Game',
  ar: 'دوز — لعبة استراتيجية كلاسيكية',
};

@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly storage = inject(DeviceStorage);
  private readonly document = inject(DOCUMENT);
  private readonly locale = signal<Language>('fa');
  private messages?: Readonly<Record<string, readonly [string, string]>>;
  private selection = 0;
  readonly language = this.locale.asReadonly();
  readonly direction = computed(() => this.language() === 'en' ? 'ltr' : 'rtl');

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.language();
      this.document.documentElement.dir = this.direction();
      this.document.title = TITLES[this.language()];
    });
  }

  async load(): Promise<void> {
    await this.applyLanguage(this.storage.getItem(LANGUAGE_KEY), false);
  }

  async setLanguage(value: unknown): Promise<void> {
    await this.applyLanguage(value, true);
  }

  private async applyLanguage(value: unknown, save: boolean): Promise<void> {
    if (value !== 'fa' && value !== 'en' && value !== 'ar') return;
    const selection = ++this.selection;
    if (value !== 'fa' && !this.messages) {
      this.messages = (await import('./messages')).MESSAGES;
    }
    if (selection !== this.selection) return;
    this.locale.set(value);
    if (save) this.storage.setItem(LANGUAGE_KEY, value);
  }

  readonly digits = (value: number | string): string => {
    const language = this.language();
    const digits = language === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : language === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : '0123456789';
    return String(value).replace(/\d/g, digit => digits[Number(digit)]);
  };

  text(key: string, params: readonly unknown[] = []): string {
    const language = this.language();
    const message = language === 'fa' ? key : (this.messages?.[key]?.[language === 'en' ? 0 : 1] ?? key);
    return params.length ? message.replace(/\{(\d+)\}/g, (_, index) => String(params[Number(index)] ?? '')) : message;
  }
}

// Read the language signal even when the text key stays the same across renders.
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(value: string | null | undefined, args?: readonly unknown[]): string {
    return value == null ? '' : this.i18n.text(value, args);
  }
}
