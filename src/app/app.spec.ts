import {TestBed} from '@angular/core/testing';
import {App} from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('closes help before returning to the title menu on Android back', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.gameState.set('PLAYING');
    app.showHelp.set(true);
    app.onNativeBack();
    expect(app.showHelp()).toBe(false);
    expect(app.gameState()).toBe('PLAYING');
    app.onNativeBack();
    expect(app.gameState()).toBe('TITLE_MENU');
  });
});
