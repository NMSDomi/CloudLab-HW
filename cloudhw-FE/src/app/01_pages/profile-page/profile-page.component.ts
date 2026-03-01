import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';
import { AlbumService } from '../../03_services/album.service';
import { PictureService } from '../../03_services/picture.service';
import { UploadService, SelectedFile } from '../../03_services/upload.service';
import { User } from '../../04_models/user.model';
import { Album } from '../../04_models/album.model';
import { environmentUrls } from '../../../enviroment/enviroment';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.css']
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);
  private albumService = inject(AlbumService);
  private pictureService = inject(PictureService);
  private http = inject(HttpClient);
  uploadService = inject(UploadService);

  profileUser = signal<User | null>(null);
  isOwnProfile = signal(false);
  loading = signal(true);
  albums = signal<Album[]>([]);
  albumsLoading = signal(false);
  coverUrls = signal<Record<string, string>>({});

  // Edit mode
  editing = signal(false);
  editName = '';
  editEmail = '';

  // Change password
  changingPassword = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // Delete album
  deletingAlbum = signal<Album | null>(null);

  // Messages
  toastMessage = signal('');
  errorMessage = signal('');

  // Create Album dialog
  creatingAlbum = signal(false);
  newAlbumName = '';
  newAlbumDescription = '';
  newAlbumIsPublic = false;
  selectedFiles = signal<SelectedFile[]>([]);
  albumCreating = signal(false);
  dragOver = signal(false);
  coverIndex = signal<number | null>(null);

  private unsubUploadComplete: (() => void) | null = null;

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
    // Listen for upload completions to refresh albums
    this.unsubUploadComplete = this.uploadService.onComplete(() => {
      this.loadAlbums();
    });

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
        this.loadAlbums();
      } else {
        this.isOwnProfile.set(false);
        this.userService.getUserById(id).subscribe({
          next: (user) => {
            this.profileUser.set(user);
            this.loading.set(false);
            this.loadAlbums();
          },
          error: () => {
            this.loading.set(false);
            this.errorMessage.set('User not found.');
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubUploadComplete) {
      this.unsubUploadComplete();
    }
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

  private loadAlbums() {
    this.albumsLoading.set(true);
    const source = this.isOwnProfile()
      ? this.albumService.getMyAlbums()
      : this.albumService.getPublicAlbums();

    source.subscribe({
      next: (albums) => {
        if (!this.isOwnProfile()) {
          const userId = this.profileUser()?.id;
          albums = albums.filter(a => a.ownerId === userId);
        }
        this.albums.set(albums);
        this.albumsLoading.set(false);
        this.loadCoverImages(albums);
      },
      error: () => {
        this.albumsLoading.set(false);
      }
    });
  }

  getCoverUrl(album: Album): string | null {
    if (!album.coverPictureId) return null;
    return this.coverUrls()[album.id] || null;
  }

  private loadCoverImages(albums: Album[]): void {
    const withCovers = albums.filter(a => a.coverPictureId);
    if (withCovers.length === 0) return;

    // Revoke old blob URLs
    const oldUrls = this.coverUrls();
    Object.values(oldUrls).forEach(url => URL.revokeObjectURL(url));

    const newUrls: Record<string, string> = {};
    let loaded = 0;

    for (const album of withCovers) {
      this.http.get(
        `${environmentUrls.pictures}/${album.coverPictureId}/thumbnail`,
        { responseType: 'blob' }
      ).subscribe({
        next: (blob) => {
          newUrls[album.id] = URL.createObjectURL(blob);
          loaded++;
          if (loaded === withCovers.length) {
            this.coverUrls.set({ ...newUrls });
          }
        },
        error: () => {
          loaded++;
          if (loaded === withCovers.length) {
            this.coverUrls.set({ ...newUrls });
          }
        }
      });
    }
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  navigateToAlbum(album: Album): void {
    if (this.uploadService.isUploading(album.id)) return;
    this.router.navigate(['/album', album.id]);
  }

  deleteAlbum(album: Album, event: Event): void {
    event.stopPropagation();
    this.deletingAlbum.set(album);
  }

  cancelDeleteAlbum(): void {
    this.deletingAlbum.set(null);
  }

  confirmDeleteAlbum(): void {
    const album = this.deletingAlbum();
    if (!album) return;
    this.deletingAlbum.set(null);

    this.albumService.deleteAlbum(album.id).subscribe({
      next: () => {
        this.albums.set(this.albums().filter(a => a.id !== album.id));
        this.showToast(`Album "${album.name}" deleted.`);
      },
      error: () => {
        this.errorMessage.set('Failed to delete album.');
      }
    });
  }

  createAlbum(): void {
    this.creatingAlbum.set(true);
    this.newAlbumName = '';
    this.newAlbumDescription = '';
    this.newAlbumIsPublic = false;
    this.selectedFiles.set([]);
    this.coverIndex.set(null);
    this.albumCreating.set(false);
    this.clearMessages();
  }

  cancelCreateAlbum(): void {
    // Revoke object URLs to free memory
    this.selectedFiles().forEach(f => URL.revokeObjectURL(f.preview));
    this.creatingAlbum.set(false);
    this.selectedFiles.set([]);
    this.clearMessages();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = ''; // reset so same file can be re-selected
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    if (event.dataTransfer?.files) {
      const imageFiles = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      this.addFiles(imageFiles);
    }
  }

  private addFiles(files: File[]): void {
    const newSelected: SelectedFile[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        name: f.name,
        size: f.size
      }));
    this.selectedFiles.set([...this.selectedFiles(), ...newSelected]);
  }

  removeFile(index: number): void {
    const files = [...this.selectedFiles()];
    URL.revokeObjectURL(files[index].preview);
    files.splice(index, 1);
    this.selectedFiles.set(files);
    // Adjust cover index
    const ci = this.coverIndex();
    if (ci !== null) {
      if (index === ci) this.coverIndex.set(null);
      else if (index < ci) this.coverIndex.set(ci - 1);
    }
  }

  selectCover(index: number): void {
    this.coverIndex.set(this.coverIndex() === index ? null : index);
  }

  async submitCreateAlbum(): Promise<void> {
    this.clearMessages();

    if (!this.newAlbumName.trim()) {
      this.errorMessage.set('Album name is required.');
      return;
    }

    this.albumCreating.set(true);

    try {
      // Step 1: Create the album
      const album = await this.albumService.createAlbum({
        name: this.newAlbumName.trim(),
        description: this.newAlbumDescription.trim() || undefined,
        isPublic: this.newAlbumIsPublic
      }).toPromise();

      if (!album) {
        this.errorMessage.set('Failed to create album.');
        this.albumCreating.set(false);
        return;
      }

      // Grab files before closing
      const files = [...this.selectedFiles()];
      const coverIdx = this.coverIndex();

      // Close the modal immediately
      this.creatingAlbum.set(false);
      this.selectedFiles.set([]);
      this.coverIndex.set(null);
      this.albumCreating.set(false);

      // Refresh albums list right away (album exists, 0 photos)
      this.loadAlbums();

      if (files.length === 0) {
        this.showToast(`Album "${album.name}" created.`);
        return;
      }

      // Step 2: Upload pictures in background via global service
      this.uploadService.uploadFiles(
        this.pictureService,
        this.albumService,
        album.id,
        album.name,
        files,
        coverIdx
      );

      this.showToast(`Album "${album.name}" created. Uploading ${files.length} photo${files.length === 1 ? '' : 's'}...`);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || 'Failed to create album.');
      this.albumCreating.set(false);
    }
  }

  formatFileSize(bytes: number): string {
    return this.formatSize(bytes);
  }
}
