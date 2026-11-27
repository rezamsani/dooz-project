import {provideHttpClient, withFetch} from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  inject,
} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import { RuntimeConfig } from './runtime-config';
import { DeviceStorage } from './game/device-storage';
import { I18n } from './i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(RuntimeConfig).load()),
    provideAppInitializer(() => {
      const storage = inject(DeviceStorage);
      const i18n = inject(I18n);
      return storage.load().then(() => i18n.load());
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
