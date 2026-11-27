import { TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CARTOON_AVATARS, cartoonAvatarUrl } from './avatar';
import { PlayerProfile } from './player-profile';
import { PlayerAvatarComponent } from './player-avatar';

@Component({
  selector: 'app-profile-panel',
  imports: [TranslatePipe, ReactiveFormsModule, PlayerAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="profile-card" [attr.aria-label]="'پروفایل من' | t">
      <div class="profile-heading">
        <app-player-avatar [avatar]="profile.avatar()" [label]="'عکس پروفایل شما' | t"
          (imageLoaded)="feedback.set('عکس Gravatar دریافت شد.')"
          (imageUnavailable)="feedback.set('عکس در دسترس نیست؛ فعلاً آواتار کارتونی نمایش داده می‌شود.')" />
        <div><h2>{{ profile.name() || ('بازیکن دوز' | t) }}</h2><p>{{ 'یک چهره برای میز بازی‌ات انتخاب کن.' | t }}</p></div>
      </div>
      <form (submit)="$event.preventDefault(); saveName()">
        <label for="profile-name">{{ 'نام بازیکن' | t }}</label>
        <div class="input-row"><input id="profile-name" autocomplete="nickname" maxlength="18" [placeholder]="'دوست داری چی صدات کنیم؟' | t" [formControl]="nameControl" /><button type="submit">{{ 'ذخیره' | t }}</button></div>
      </form>
      <fieldset><legend>{{ 'آواتارهای کارتونی' | t }}</legend>
        <div class="avatar-options">
          @for (id of cartoons; track id; let i = $index) {
            <button type="button" [class.selected]="profile.avatar().cartoon === id && !profile.avatar().gravatarHash"
              [attr.aria-pressed]="profile.avatar().cartoon === id && !profile.avatar().gravatarHash"
              [attr.aria-label]="('انتخاب آواتار کارتونی {0}' | t: [i + 1])" (click)="profile.useCartoon(id); feedback.set('آواتار کارتونی انتخاب شد.')">
              <img [src]="cartoonUrl(id)" alt="" width="192" height="192" />
            </button>
          }
        </div>
      </fieldset>
      <details [open]="!!profile.avatar().gravatarHash">
        <summary>{{ 'عکس خودت از Gravatar' | t }} <span aria-hidden="true">＋</span></summary>
        <p>{{ 'اگر در' | t }} <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer">Gravatar</a> {{ 'عکس داری، ایمیل همون حساب رو وارد کن.' | t }}</p>
        <form (submit)="$event.preventDefault(); connectGravatar()">
          <label for="gravatar-email">{{ 'ایمیل Gravatar' | t }}</label>
          <input id="gravatar-email" type="email" dir="ltr" autocomplete="email" maxlength="254" placeholder="you@example.com" [formControl]="emailControl" [attr.aria-invalid]="emailControl.touched && emailControl.invalid" />
          @if (emailControl.touched && emailControl.invalid) { <p class="error" role="alert">{{ 'یک آدرس ایمیل معتبر وارد کن.' | t }}</p> }
          <button class="connect-button" type="submit">{{ 'دریافت عکس پروفایل' | t }}</button>
        </form>
        <p>{{ 'ایمیل ذخیره نمی‌شود. اگر عکسی پیدا نشه، آواتار کارتونی‌ات نمایش داده می‌شه.' | t }}</p>
        @if (profile.avatar().gravatarHash) { <button class="remove-button" type="button" (click)="profile.useCartoon(profile.avatar().cartoon); emailControl.reset(); feedback.set('عکس Gravatar حذف شد.')">{{ 'استفاده از آواتار کارتونی' | t }}</button> }
      </details>
      @if (feedback()) { <p class="feedback" role="status">{{ (feedback() | t) }}</p> }
    </section>
  `,
  styles: `
    :host { display:block; margin-bottom:24px; }
    .profile-card { padding:20px; border:1px solid var(--line); border-radius:22px; background:var(--surface); }
    .profile-heading { display:flex; align-items:center; gap:14px; margin-bottom:22px; }
    .profile-heading app-player-avatar { width:68px; height:68px; }
    h2 { font-size:17px; font-weight:800; overflow-wrap:anywhere; }
    p { font-size:12px; line-height:1.9; color:var(--muted); margin-top:8px; }
    label,legend { display:block; font-size:12px; font-weight:700; margin-bottom:10px; }
    input { min-width:0; width:100%; min-height:46px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:var(--canvas); color:var(--ink); font:inherit; font-size:13px; }
    .input-row { display:flex; gap:8px; }
    button { min-height:44px; padding:8px 14px; border-radius:12px; font-size:12px; font-weight:700; background:var(--soft); color:var(--accent); }
    fieldset { margin-block:22px; }
    .avatar-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .avatar-options button { padding:6px; border:2px solid transparent; background:var(--canvas); }
    .avatar-options .selected { border-color:var(--accent); background:var(--soft); }
    .avatar-options img { display:block; width:64px; height:64px; max-width:100%; border-radius:50%; margin:auto; }
    details { border-top:1px solid var(--line); padding-top:8px; }
    summary { min-height:44px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-size:13px; font-weight:700; list-style:none; }
    summary::-webkit-details-marker { display:none; }
    details form { margin-top:16px; }
    a { color:var(--accent); text-decoration:underline; }
    .connect-button { width:100%; margin-top:10px; }
    .remove-button { background:transparent; text-decoration:underline; margin-top:8px; }
    .feedback { padding-top:8px; }.error { color:#e56868; }
    button:focus-visible,input:focus-visible,summary:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
  `,
})
export class ProfilePanel {
  readonly profile = inject(PlayerProfile);
  readonly cartoons = CARTOON_AVATARS;
  protected readonly cartoonUrl = cartoonAvatarUrl;
  readonly nameControl = new FormControl(this.profile.name(), {nonNullable:true});
  readonly emailControl = new FormControl('', {nonNullable:true, validators:[Validators.required,Validators.email,Validators.maxLength(254)]});
  readonly feedback = signal<string | null>(null);
  saveName(): void { this.profile.setName(this.nameControl.value); this.nameControl.setValue(this.profile.name()); this.feedback.set('نام بازیکن ذخیره شد.'); }
  connectGravatar(): void {
    this.emailControl.setValue(this.emailControl.value.trim());
    this.emailControl.markAsTouched();
    if (this.emailControl.invalid) return;
    this.feedback.set('در حال دریافت عکس؛ آواتار کارتونی همیشه در دسترس است.');
    this.profile.useGravatar(this.emailControl.value);
    this.emailControl.reset();
  }
}
