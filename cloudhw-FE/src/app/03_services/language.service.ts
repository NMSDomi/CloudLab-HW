import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'hu';
const STORAGE_KEY = 'app-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);

  readonly currentLang = signal<AppLanguage>(this.getSavedLang());

  init(): void {
    const lang = this.getSavedLang();
    this.translate.addLangs(['en', 'hu']);
    this.translate.setDefaultLang('en');
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  switchLang(lang: AppLanguage): void {
    this.translate.use(lang);
    this.currentLang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  toggleLang(): void {
    this.switchLang(this.currentLang() === 'en' ? 'hu' : 'en');
  }

  private getSavedLang(): AppLanguage {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'hu' ? 'hu' : 'en';
  }
}
