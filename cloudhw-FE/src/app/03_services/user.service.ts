import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap, map, switchMap, finalize, catchError } from 'rxjs';
import { Observable, of } from 'rxjs';
import { User } from '../04_models/user.model';
import { environmentUrls } from '../../enviroment/enviroment';

@Injectable({ providedIn: 'root' })
export class UserService {
    /** Access token lives only in memory — never written to any storage. */
    private accessToken: string | null = null;
    private authInitialized = false;

    public currentUser = signal<User | null>(null);

    constructor(private http: HttpClient) { }

    /**
     * Called once by APP_INITIALIZER before the app renders.
     * Attempts a silent refresh via the HttpOnly cookie.
     */
    initializeAuth(): Observable<User | null> {
        return this.refreshToken().pipe(
            switchMap(() => this.getMe(false)),
            tap(() => { this.authInitialized = true; }),
            catchError(() => {
                this.authInitialized = true;
                return of(null);
            })
        );
    }

    isAuthInitialized(): boolean {
        return this.authInitialized;
    }

    login(email: string, password: string, rememberMe = false) {
        return this.http.post(`${environmentUrls.users}/login`, { email, password, rememberMe }, { withCredentials: true }).pipe(
            tap((resp: any) => {
                this.accessToken = resp.token;
            }),
            switchMap(() => this.getMe(false))
        );
    }

    logout() {
        return this.http.post(`${environmentUrls.users}/logout`, {}, { withCredentials: true }).pipe(
            finalize(() => {
                this.accessToken = null;
                this.currentUser.set(null);
            })
        );
    }

    refreshToken() {
        // No body — the HttpOnly cookie is sent automatically by the browser.
        return this.http.post<{ token: string }>(`${environmentUrls.users}/refresh-token`, {}, { withCredentials: true }).pipe(
            tap(resp => {
                this.accessToken = resp.token;
            }),
            map(resp => resp.token)
        );
    }

    /** Clears in-memory auth state without making an HTTP call. Used by the guard when refresh fails. */
    clearInMemoryAuth(): void {
        this.accessToken = null;
        this.currentUser.set(null);
    }

    getMe(withCache: boolean = true): Observable<User | null> {

        if (withCache && this.currentUser()) {
            return of(this.currentUser());
        }

        return this.http.get<any>(`${environmentUrls.users}/me`).pipe(
            map(backendUser => this.mapBackendUserToModel(backendUser)),
            tap(user => this.currentUser.set(user))
        );
    }

    private mapBackendUserToModel(backendUser: any): User {
        const roleValue = backendUser.roles ?? backendUser.role;
        const role = Array.isArray(roleValue) ? roleValue[0] : roleValue;

        return {
            id: backendUser.id,
            name: backendUser.name,
            email: backendUser.email,
            userName: backendUser.userName,
            role
        };
    }

    updateMe(data: User) {
        return this.http.put(`${environmentUrls.users}/me`, data);
    }

    changePassword(currentPassword: string, newPassword: string) {
        return this.http.post(`${environmentUrls.users}/change-password`, {
            currentPassword,
            newPassword
        });
    }

    resetPassword(email: string, token: string, newPassword: string) {
        return this.http.post(`${environmentUrls.users}/reset-password`, {
            email,
            token,
            newPassword
        });
    }

    forgotPassword(email: string) {
        return this.http.post(`${environmentUrls.users}/forgot-password`, { email });
    }

    confirmEmail(userId: string, token: string) {
        return this.http.get(`${environmentUrls.users}/confirm-email`, {
            params: { userId, token }
        });
    }

    resendConfirmation(email: string) {
        return this.http.post(`${environmentUrls.users}/resend-confirmation`, { email });
    }

    register(data: { email: string; password: string; name: string; role?: string }) {
        return this.http.post(`${environmentUrls.users}/register`, data);
    }

    getAllUsers() {
        return this.http.get<any[]>(`${environmentUrls.users}/all`).pipe(
            map(backendUsers => backendUsers.map(u => this.mapBackendUserToModel(u)))
        );
    }

    searchUsers(q: string): Observable<{ id: string; name: string; email: string }[]> {
        return this.http.get<any[]>(`${environmentUrls.users}/search`, { params: { q } }).pipe(
            map(users => users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email
            })))
        );
    }

    getUserById(id: string) {
        return this.http.get<any>(`${environmentUrls.users}/public/${encodeURIComponent(id)}`).pipe(
            map(u => this.mapBackendUserToModel(u))
        );
    }

    deleteUser(id: string) {
        return this.http.delete(`${environmentUrls.users}/${encodeURIComponent(id)}`);
    }

    updateRole(id: string, role: string) {
        return this.http.put(`${environmentUrls.users}/role/${encodeURIComponent(id)}`, { role });
    }

    getToken(): string | null {
        return this.accessToken;
    }

    getRefreshToken(): string | null {
        return null; // Managed server-side via HttpOnly cookie — not accessible from JS
    }

    isTokenExpired(token: string | null): boolean {
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiry = payload.exp;
            return (Math.floor(Date.now() / 1000)) >= expiry;
        } catch {
            return true;
        }
    }

    getCurrentUser(): any | null {
        return this.currentUser();
    }

    hasRole(role: 'admin' | 'editor'): boolean {
        const user = this.currentUser();
        if (!user || !user.role) return false;

        // Handle single role as string
        if (typeof user.role === 'string') {
            return user.role.toLowerCase() === role.toLowerCase();
        }

        return false;
    }

    isLoggedIn(): boolean {
        return !!this.getToken() && !!this.currentUser();
    }

}