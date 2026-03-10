import { Routes } from '@angular/router';
import { MainPageComponent } from './01_pages/main-page/main-page.component';
import { LoginPageComponent } from './01_pages/login-page/login-page.component';
import { ProfilePageComponent } from './01_pages/profile-page/profile-page.component';
import { AlbumPageComponent } from './01_pages/album-page/album-page.component';
import { HomePageComponent } from './01_pages/home-page/home-page.component';
import { ConfirmEmailPageComponent } from './01_pages/confirm-email-page/confirm-email-page.component';
import { ResetPasswordPageComponent } from './01_pages/reset-password-page/reset-password-page.component';
import { AuthGuard } from './03_services/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginPageComponent },
    { path: 'confirm-email', component: ConfirmEmailPageComponent },
    { path: 'reset-password', component: ResetPasswordPageComponent },
    {
        path: '',
        component: MainPageComponent,
        children: [
            { path: 'profile/:id', component: ProfilePageComponent, canActivate: [AuthGuard] },
            { path: 'album/:id', component: AlbumPageComponent },
            { path: '', component: HomePageComponent },
        ],
    },
];