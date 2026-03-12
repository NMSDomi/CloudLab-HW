import { inject } from '@angular/core';
import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { UserService } from './user.service';
import { AuthRefreshStateService } from './auth-refresh-state.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const userService = inject(UserService);
  const refreshState = inject(AuthRefreshStateService);
  const token = userService.getToken();

  let authReq = req.clone({ withCredentials: true });
  if (token) {
    authReq = authReq.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        !req.url.endsWith('/login') &&
        !req.url.endsWith('/refresh-token')
      ) {
        if (!refreshState.isRefreshing) {
          refreshState.start();

          return userService.refreshToken().pipe(
            switchMap(newToken => {
              refreshState.resolve(newToken);
              return next(
                req.clone({
                  withCredentials: true,
                  setHeaders: { Authorization: `Bearer ${newToken}` }
                })
              );
            }),
            catchError(err => {
              refreshState.fail();
              userService.logout();
              return throwError(() => err);
            }),
            finalize(() => {
              refreshState.isRefreshing = false;
            })
          );
        } else {
          return refreshState.tokenSubject.pipe(
            filter(t => t !== null),
            take(1),
            switchMap(t =>
              next(
                req.clone({
                  withCredentials: true,
                  setHeaders: { Authorization: `Bearer ${t}` }
                })
              )
            )
          );
        }
      }
      return throwError(() => error);
    })
  );
};
