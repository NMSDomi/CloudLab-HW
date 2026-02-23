import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap, map, switchMap, finalize } from 'rxjs';
import { Observable, of } from 'rxjs';
import { User } from '../04_models/user.model';
import { environmentUrls } from '../../enviroment/enviroment';

@Injectable({ providedIn: 'root' })
export class UserService {
    private tokenKey = 'access_token';
    private refreshKey = 'refresh_token';

    public currentUser = signal<User | null>(null);

    constructor(private http: HttpClient) { }

    login(email: string, password: string) {
        return this.http.post(`${environmentUrls.users}/login`, { email, password }).pipe(
            tap((resp: any) => {
                localStorage.setItem(this.tokenKey, resp.token);
                localStorage.setItem(this.refreshKey, resp.refreshToken);
            }),
            switchMap(() => this.getMe(false))
        );
    }

    logout() {
        return this.http.post(`${environmentUrls.users}/logout`, {}).pipe(
            finalize(() => {
                localStorage.removeItem(this.tokenKey);
                localStorage.removeItem(this.refreshKey);
                this.currentUser.set(null);
            })
        );
    }

    refreshToken() {
        const token = localStorage.getItem(this.tokenKey);
        const refreshToken = localStorage.getItem(this.refreshKey);
        return this.http.post<{ token: string, refreshToken: string }>(`${environmentUrls.users}/refresh-token`, {
        token,
        refreshToken
        }).pipe(
        tap(resp => {
            localStorage.setItem(this.tokenKey, resp.token);
            localStorage.setItem(this.refreshKey, resp.refreshToken);
        }),
        map(resp => resp.token)
        );
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
        return {
            id: backendUser.Id || backendUser.id,
            name: backendUser.Name || backendUser.name,
            email: backendUser.Email || backendUser.email,
            userName: backendUser.UserName || backendUser.userName,
            role: backendUser.Roles || backendUser.roles || []
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

    resetPassword(email: string, newPassword: string) {
        return this.http.post(`${environmentUrls.users}/reset-password`, {
            email,
            newPassword
        });
    }

    register(data: { email: string; password: string; name: string; role?: string }) {
        return this.http.post(`${environmentUrls.users}/register`, data);
    }

    getAllUsers() {
        return this.http.get<any[]>(`${environmentUrls.users}/all`).pipe(
            map(backendUsers => backendUsers.map(u => this.mapBackendUserToModel(u)))
        );
    }

    deleteUser(id: string) {
        return this.http.delete(`${environmentUrls.users}/${encodeURIComponent(id)}`);
    }

    updateRole(id: string, role: string) {
        return this.http.put(`${environmentUrls.users}/role/${encodeURIComponent(id)}`, { role });
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    getRefreshToken(): string | null {
        return localStorage.getItem(this.refreshKey);
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