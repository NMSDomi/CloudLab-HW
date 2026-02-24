import { Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../03_services/user.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private userService = inject(UserService);
  private router = inject(Router);

  dropdownOpen = false;

  uploadClicked = output<void>();

  currentUser = this.userService.currentUser;

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return u.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  onUpload() {
    this.uploadClicked.emit();
  }

  onLogin() {
    this.router.navigate(['/login']);
  }

  onLogout() {
    this.userService.logout().subscribe();
    this.router.navigate(['/login']);
  }
}

