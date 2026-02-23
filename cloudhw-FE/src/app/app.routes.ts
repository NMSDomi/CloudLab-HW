import { Routes } from '@angular/router';
import { MainPageComponent } from './01_pages/main-page/main-page.component';
import { LoginPageComponent } from './01_pages/login-page/login-page.component';
import { AuthGuard } from './03_services/auth.guard';

export const routes: Routes = [
    { path: '', component: MainPageComponent,
      children: [
        {path: 'login', component: LoginPageComponent}
      ]
    },
];