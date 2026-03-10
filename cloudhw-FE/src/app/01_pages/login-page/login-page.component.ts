import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';
import { PasswordStrengthComponent } from '../../02_components/password-strength/password-strength.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordStrengthComponent],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent {
  view: 'login' | 'register' | 'forgot' = 'login';
  loading = false;
  errorMessage = '';
  successMessage = '';

  loginEmail = '';
  loginPassword = '';
  rememberMe = false;

  registerName = '';
  registerEmail = '';
  registerPassword = '';

  forgotEmail = '';

  registerPasswordValid = false;

  private emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  constructor(private userService: UserService, private router: Router) {}

  get isRegisterFormValid(): boolean {
    return (
      this.registerName.trim().length > 0 &&
      this.emailRegex.test(this.registerEmail) &&
      this.registerPasswordValid
    );
  }

  onLogin() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    this.userService.login(this.loginEmail, this.loginPassword, this.rememberMe).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Hibás email vagy jelszó.';
      }
    });
  }

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    this.userService.register({
      name: this.registerName,
      email: this.registerEmail,
      password: this.registerPassword
    }).subscribe({
      next: (resp: any) => {
        this.loading = false;
        this.successMessage = resp?.message || 'Sikeres regisztráció. Kérjük, erősítsd meg az email címedet.';
        // Switch back to login view so user can log in after confirming
        this.view = 'login';
        this.loginEmail = this.registerEmail;
        this.loginPassword = '';
      },
      error: (err) => {
        this.loading = false;
        if (err?.error && Array.isArray(err.error)) {
          this.errorMessage = err.error.map((e: any) => e.description).join(' ');
        } else {
          this.errorMessage = err?.error?.message || 'Regisztráció sikertelen. Próbáld újra.';
        }
      }
    });
  }

  onForgotPassword() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    this.userService.forgotPassword(this.forgotEmail).subscribe({
      next: (resp: any) => {
        this.loading = false;
        this.successMessage = resp?.message || 'Ha az email cím regisztrálva van, küldtünk egy jelszó visszaállító levelet.';
      },
      error: () => {
        this.loading = false;
        this.successMessage = 'Ha az email cím regisztrálva van, küldtünk egy jelszó visszaállító levelet.';
      }
    });
  }

  switchView(view: 'login' | 'register' | 'forgot') {
    this.view = view;
    this.errorMessage = '';
    this.successMessage = '';
  }
}
