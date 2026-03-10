import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';
import { PasswordStrengthComponent } from '../../02_components/password-strength/password-strength.component';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordStrengthComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrls: ['./reset-password-page.component.css']
})
export class ResetPasswordPageComponent implements OnInit {
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';

  loading = false;
  errorMessage = '';
  successMessage = '';
  invalidLink = false;
  passwordValid = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!this.email || !this.token) {
      this.invalidLink = true;
    }
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'A két jelszó nem egyezik.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'A jelszónak legalább 8 karakter hosszúnak kell lennie.';
      return;
    }

    this.loading = true;

    this.userService.resetPassword(this.email, this.token, this.newPassword).subscribe({
      next: (resp: any) => {
        this.loading = false;
        this.successMessage = resp?.message || 'Jelszó sikeresen megváltoztatva!';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'A jelszó visszaállítás sikertelen. A link lejárhatott.';
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
