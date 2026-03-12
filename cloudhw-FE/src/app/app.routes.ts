import { Routes } from '@angular/router';
import { AuthGuard } from './03_services/auth.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./01_pages/login-page/login-page.component').then(m => m.LoginPageComponent)
    },
    {
        path: 'confirm-email',
        loadComponent: () => import('./01_pages/confirm-email-page/confirm-email-page.component').then(m => m.ConfirmEmailPageComponent)
    },
    {
        path: 'reset-password',
        loadComponent: () => import('./01_pages/reset-password-page/reset-password-page.component').then(m => m.ResetPasswordPageComponent)
    },
    {
        path: '',
        loadComponent: () => import('./01_pages/main-page/main-page.component').then(m => m.MainPageComponent),
        children: [
            {
                path: 'profile/:id',
                loadComponent: () => import('./01_pages/profile-page/profile-page.component').then(m => m.ProfilePageComponent),
                canActivate: [AuthGuard]
            },
            {
                path: 'album/:id',
                loadComponent: () => import('./01_pages/album-page/album-page.component').then(m => m.AlbumPageComponent)
            },
            {
                path: '',
                loadComponent: () => import('./01_pages/home-page/home-page.component').then(m => m.HomePageComponent)
            },
        ],
    },
];