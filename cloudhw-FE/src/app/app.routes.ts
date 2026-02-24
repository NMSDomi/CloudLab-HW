import { Routes } from '@angular/router';
import { MainPageComponent } from './01_pages/main-page/main-page.component';
import { LoginPageComponent } from './01_pages/login-page/login-page.component';
import { ProfilePageComponent } from './01_pages/profile-page/profile-page.component';
import { HomePageComponent } from './01_pages/home-page/home-page.component';
import { AuthGuard } from './03_services/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginPageComponent },
    {
        path: '',
        component: MainPageComponent,
        canActivate: [AuthGuard],
        children: [
            { path: 'profile/:id', component: ProfilePageComponent },
            { path: '', component: HomePageComponent },
        ],
    },
];