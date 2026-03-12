import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Holds the in-flight refresh state shared between concurrent HTTP requests.
 * Extracted from the module-level variables in auth.interceptor.ts so it is
 * properly scoped to the DI root injector (testable, SSR-safe).
 */
@Injectable({ providedIn: 'root' })
export class AuthRefreshStateService {
  isRefreshing = false;
  readonly tokenSubject = new BehaviorSubject<string | null>(null);

  start(): void {
    this.isRefreshing = true;
    this.tokenSubject.next(null);
  }

  resolve(token: string): void {
    // DO NOT set isRefreshing = false here — let finalize() in the interceptor handle it.
    // This prevents race conditions where concurrent requests with the new token might
    // get a 401 and think they need to refresh again.
    this.tokenSubject.next(token);
  }

  fail(): void {
    this.isRefreshing = false;
    this.tokenSubject.next(null);
  }
}
