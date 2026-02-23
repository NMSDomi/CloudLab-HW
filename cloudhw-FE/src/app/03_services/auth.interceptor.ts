import { inject } from '@angular/core';
import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { UserService } from './user.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const userService = inject(UserService);
  const token = userService.getToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
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
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return userService.refreshToken().pipe(
            switchMap(newToken => {
              refreshTokenSubject.next(newToken);
              return next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` }
                })
              );
            }),
            catchError(err => {
              userService.logout();
              return throwError(() => err);
            }),
            finalize(() => {
              isRefreshing = false;
            })
          );
        } else {
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(token =>
              next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${token}` }
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