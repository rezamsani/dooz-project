import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const ICON_PATHS = {
  play: 'M8 5.5v13l11-6.5L8 5.5Z',
  style: 'M12 3a9 9 0 1 0 0 18h1a1.7 1.7 0 0 0 1.1-3c-.9-.8-.4-2.3.9-2.3H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z M7 12h.1 M9 8h.1 M14 7.5h.1 M17.5 11h.1',
  profile: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-1.5a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5V21',
  bot: 'M12 6V3 M10.5 3h3 M5 9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9Z M2 11v4 M22 11v4 M8.5 11h.1 M15.5 11h.1 M9 15h6',
  friends: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-1.5a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5V21 M18.5 5.5a3 3 0 0 1 0 5.8 M5.5 5.5a3 3 0 0 0 0 5.8',
  online: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3.5 12h17 M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  puzzle: 'M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z M9 12l2 2 4-4',
  sound: 'M3 9h4l5-4v14l-5-4H3V9Z M16 9a4 4 0 0 1 0 6 M18.5 6a8 8 0 0 1 0 12',
  chevron: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12 M18 6 6 18',
  arrow: 'M19 12H5m6 6-6-6 6-6',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M9.5 9.5a2.5 2.5 0 1 1 4.1 1.9c-1 1-1.6 1.2-1.6 2.6 M12 17h.1',
  day: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19',
  night: 'M20.9 13.8A9 9 0 0 1 10.2 3.1 9 9 0 1 0 20.9 13.8Z',
  undo: 'M8 4 3 9l5 5 M3 9h11a5 5 0 0 1 0 10h-2',
  hint: 'M9 18h6 M10 21h4 M8 15c0-1.3-2-3-2-6a6 6 0 0 1 12 0c0 3-2 4.7-2 6H8Z',
  mute: 'M3 9h4l5-4v14l-5-4H3V9Z M16 10l5 5m0-5-5 5',
} as const;

@Component({
  selector: 'app-dooz-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
    stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="paths[name()]" /></svg>`,
  styles: `:host { display: inline-grid; place-items: center; flex: none; width: 1.3em; height: 1.3em; }
    svg { display: block; width: 100%; height: 100%; }`,
})
export class DoozIcon {
  readonly name = input.required<keyof typeof ICON_PATHS>();
  protected readonly paths = ICON_PATHS;
}
