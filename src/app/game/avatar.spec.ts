import { TestBed } from '@angular/core/testing';
import { gravatarUrl, hashGravatarEmail, normalizeAvatar } from './avatar';
import { PlayerAvatarComponent } from './player-avatar';
import { PlayerProfile } from './player-profile';

describe('player avatars', () => {
  afterEach(() => localStorage.removeItem('dooz_profile_v1'));

  it('normalizes email and matches the published Gravatar SHA-256 example', () => {
    expect(hashGravatarEmail(' MyEmailAddress@example.com ')).toBe('84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee');
    expect(hashGravatarEmail('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashGravatarEmail('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('rejects arbitrary remote image identifiers', () => {
    expect(normalizeAvatar({cartoon:'../anything',gravatarHash:'https://example.com/image'})).toEqual({cartoon:'mint',gravatarHash:null});
    expect(gravatarUrl('https://example.com')).toBeNull();
  });

  it('keeps a local cartoon when a Gravatar image fails, and can load a different hash', async () => {
    const fixture = TestBed.createComponent(PlayerAvatarComponent);
    fixture.componentRef.setInput('avatar',{cartoon:'peach',gravatarHash:'a'.repeat(64)});
    fixture.detectChanges();
    const remote: HTMLImageElement = fixture.nativeElement.querySelector('.remote');
    remote.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.remote')).toBeNull();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/avatars/ceramic/peach.jpg');
    fixture.componentRef.setInput('avatar',{cartoon:'peach',gravatarHash:'b'.repeat(64)});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.remote').getAttribute('src')).toContain('b'.repeat(64));
  });

  it('persists the avatar identifier without storing the email and allows removing Gravatar', () => {
    localStorage.removeItem('dooz_profile_v1');
    const profile = TestBed.inject(PlayerProfile);
    profile.setName('  بازیکن  ');
    profile.useGravatar('myemailaddress@example.com');
    const saved = localStorage.getItem('dooz_profile_v1')!;
    expect(saved).not.toContain('@');
    expect(JSON.parse(saved).avatar.gravatarHash).toBe(hashGravatarEmail('myemailaddress@example.com'));
    profile.useCartoon('lilac');
    expect(profile.avatar()).toEqual({cartoon:'lilac',gravatarHash:null});
    expect(profile.name()).toBe('بازیکن');
  });
});
