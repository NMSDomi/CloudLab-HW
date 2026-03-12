import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './03_services/auth.interceptor';
import { UserService } from './03_services/user.service';
import { LanguageService } from './03_services/language.service';
import { MultiFileTranslateLoader } from './03_services/multi-file-translate-loader';
import { firstValueFrom } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

function initAuth(userService: UserService): () => Promise<any> {
  return () => firstValueFrom(userService.initializeAuth());
}

function initLanguage(languageService: LanguageService): () => void {
  return () => languageService.init();
}

export function createTranslateLoader(http: HttpClient): MultiFileTranslateLoader {
  return new MultiFileTranslateLoader(http);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
      })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideAnimationsAsync(),
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient],
      },
      defaultLanguage: 'en',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [UserService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initLanguage,
      deps: [LanguageService],
      multi: true
    },
  ],
};
