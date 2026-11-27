import { I18n } from '../i18n';
import { inject, ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AVATAR_ART_DIR, cartoonAvatarUrl, gravatarUrl, normalizeAvatar, PlayerAvatar } from './avatar';

@Component({
  selector: 'app-player-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img [src]="fallbackUrl()" [alt]="label() || i18n.text('عکس بازیکن')" width="192" height="192" />
    @if (remoteUrl(); as url) {
      @if (failedUrl() !== url) {
        <img class="remote" [class.ready]="loadedUrl() === url" [src]="url" alt="" width="80" height="80"
          referrerpolicy="no-referrer" (load)="loadedUrl.set(url); imageLoaded.emit()"
          (error)="failedUrl.set(url); imageUnavailable.emit()" />
      }
    }
  `,
  styles: `
    :host { display: block; position: relative; width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: #e0ede5; box-shadow: 0 0 0 1px var(--line, #dfe5de); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .remote { position: absolute; inset: 0; opacity: 0; } .remote.ready { opacity: 1; }
  `,
})
export class PlayerAvatarComponent {
  readonly i18n = inject(I18n);
  readonly avatar = input<PlayerAvatar | undefined>(undefined);
  readonly robot = input<'EASY' | 'MEDIUM' | 'HARD' | null>(null);
  readonly label = input('');
  readonly imageLoaded = output<void>();
  readonly imageUnavailable = output<void>();
  readonly failedUrl = signal<string | null>(null);
  readonly loadedUrl = signal<string | null>(null);
  readonly fallbackUrl = computed(() => this.robot()
    ? `${AVATAR_ART_DIR}/robot-${this.robot()!.toLowerCase()}.jpg`
    : cartoonAvatarUrl(normalizeAvatar(this.avatar()).cartoon));
  readonly remoteUrl = computed(() => this.robot() ? null : gravatarUrl(this.avatar()?.gravatarHash ?? null));
}
