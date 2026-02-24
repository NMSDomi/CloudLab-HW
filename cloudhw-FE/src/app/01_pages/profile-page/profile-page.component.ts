import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';
import { User } from '../../04_models/user.model';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css']
})
export class ProfilePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);

  profileUser = signal<User | null>(null);
  isOwnProfile = signal(false);
  loading = signal(true);

  // Edit mode
  editing = signal(false);
  editName = '';
  editEmail = '';

  // Change password
  changingPassword = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // Messages
  toastMessage = signal('');
  errorMessage = signal('');

  userInitials = computed(() => {
    const u = this.profileUser();
    if (!u) return '';
    return u.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;

      const currentUser = this.userService.currentUser();
      if (currentUser && currentUser.id === id) {
        this.isOwnProfile.set(true);
        this.profileUser.set(currentUser);
        this.editName = currentUser.name;
        this.editEmail = currentUser.email;
        this.loading.set(false);
      } else {
        this.isOwnProfile.set(false);
        this.userService.getUserById(id).subscribe({
          next: (user) => {
            this.profileUser.set(user);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.errorMessage.set('User not found.');
          }
        });
      }
    });
  }

  startEdit() {
    const u = this.profileUser();
    if (u) {
      this.editName = u.name;
      this.editEmail = u.email;
    }
    this.editing.set(true);
    this.clearMessages();
  }

  cancelEdit() {
    this.editing.set(false);
    this.clearMessages();
  }

  saveProfile() {
    this.clearMessages();
    const u = this.profileUser();
    if (!u) return;

    this.userService.updateMe({ ...u, name: this.editName, email: this.editEmail }).subscribe({
      next: () => {
        this.profileUser.set({ ...u, name: this.editName, email: this.editEmail });
        this.userService.currentUser.set({ ...u, name: this.editName, email: this.editEmail });
        this.editing.set(false);
        this.showToast('Profile updated successfully.');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to update profile.');
      }
    });
  }

  toggleChangePassword() {
    this.changingPassword.set(!this.changingPassword());
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.clearMessages();
  }

  savePassword() {
    this.clearMessages();

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters.');
      return;
    }

    this.userService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showToast('Password changed successfully.');
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.[0]?.description || err?.error?.message || 'Failed to change password.');
      }
    });
  }

  private clearMessages() {
    this.toastMessage.set('');
    this.errorMessage.set('');
  }

  private showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}
