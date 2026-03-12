import { Component, OnInit } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';

@Component({
  selector: 'app-confirm-email-page',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './confirm-email-page.component.html',
  styleUrls: ['./confirm-email-page.component.css']
})
export class ConfirmEmailPageComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit() {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!userId || !token) {
      this.status = 'error';
      this.message = 'Érvénytelen megerősítő link.';
      return;
    }

    this.userService.confirmEmail(userId, token).subscribe({
      next: (resp: any) => {
        this.status = 'success';
        this.message = resp?.message || 'Email sikeresen megerősítve!';
      },
      error: (err) => {
        this.status = 'error';
        this.message = err?.error?.message || 'A megerősítő link érvénytelen vagy lejárt.';
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
