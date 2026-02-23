import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { UserService } from './user.service';

/**
 * AuthGuard - Checks if user is authenticated
 * Attempts to refresh token if expired
 * Redirects to login if not authenticated
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router) {}

  canActivate(): Observable<boolean> {
    const token = this.userService.getToken();

    if (token && !this.userService.isTokenExpired(token)) {
      // Token is valid, try to get user info
      return this.userService.getMe(false).pipe(
        map(() => true),
        catchError(() => of(true))
      );
    }

    const refreshToken = this.userService.getRefreshToken();
    if (refreshToken) {
      return this.userService.refreshToken().pipe(
        switchMap(() => this.userService.getMe(false)),
        map(() => true),
        catchError(() => {
          this.userService.logout();
          this.router.navigate(['/login']);
          return of(false);
        })
      );
    }

    // No valid token - redirect to login
    this.userService.logout();
    this.router.navigate(['/login']);
    return of(false);
  }
}

/**
 * AdminGuard - Allows access only to users with Admin role
 * Extends AuthGuard to first verify authentication
 */
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router, private authGuard: AuthGuard) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    // First check if user is authenticated
    return this.authGuard.canActivate().pipe(
      switchMap((isAuthenticated) => {
        if (!isAuthenticated) {
          return of(false);
        }

        // Check if user has admin role
        if (this.userService.hasRole('admin')) {
          return of(true);
        }

        // User is authenticated but not admin
        console.warn('Access denied: Admin role required');
        this.router.navigate(['/dashboard']);
        return of(false);
      })
    );
  }
}

/**
 * EditorGuard - Allows access to users with Editor or Admin role
 * Can be used for routes that editors should access
 */
@Injectable({ providedIn: 'root' })
export class EditorGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router, private authGuard: AuthGuard) {}

  canActivate(): Observable<boolean> {
    // First check if user is authenticated
    return this.authGuard.canActivate().pipe(
      switchMap((isAuthenticated) => {
        if (!isAuthenticated) {
          return of(false);
        }

        // Check if user has editor or admin role
        if (this.userService.hasRole('editor') || this.userService.hasRole('admin')) {
          return of(true);
        }

        // User is authenticated but not editor/admin
        console.warn('Access denied: Editor role required');
        this.router.navigate(['/']);
        return of(false);
      })
    );
  }
}