import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../03_services/user.service';
import { AlbumService } from '../../03_services/album.service';

interface SearchUser {
  id: string;
  name: string;
  email: string;
}

interface ShareEntry {
  userId: string;
  userName: string;
  sharedAt?: string;
}

@Component({
  selector: 'app-share-album-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-album-modal.component.html',
  styleUrls: ['./share-album-modal.component.css']
})
export class ShareAlbumModalComponent implements OnInit, OnDestroy {
  @Input() albumId!: string;
  @Input() albumName!: string;
  @Output() closed = new EventEmitter<void>();

  private userService = inject(UserService);
  private albumService = inject(AlbumService);

  searchQuery = '';
  searchResults = signal<SearchUser[]>([]);
  searching = signal(false);
  private searchTimer: any;

  /** Staged users — selected but not yet shared */
  selectedUsers = signal<SearchUser[]>([]);

  /** Users the album is already shared with (persisted) */
  currentShares = signal<ShareEntry[]>([]);
  sharesLoading = signal(true);

  saving = signal(false);
  errorMessage = signal('');

  ngOnInit() {
    this.loadCurrentShares();
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer);
  }

  private loadCurrentShares() {
    this.sharesLoading.set(true);
    this.albumService.getAlbumShares(this.albumId).subscribe({
      next: (shares) => {
        this.currentShares.set(shares);
        this.sharesLoading.set(false);
      },
      error: () => this.sharesLoading.set(false)
    });
  }

  onSearchInput() {
    clearTimeout(this.searchTimer);
    const q = this.searchQuery.trim();
    if (q.length < 2) {
      this.searchResults.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => {
      this.userService.searchUsers(q).subscribe({
        next: (results) => {
          const selectedIds = new Set(this.selectedUsers().map(u => u.id));
          const sharedIds = new Set(this.currentShares().map(s => s.userId));
          const meId = this.userService.currentUser()?.id;
          this.searchResults.set(
            results.filter(r => !selectedIds.has(r.id) && !sharedIds.has(r.id) && r.id !== meId)
          );
          this.searching.set(false);
        },
        error: () => this.searching.set(false)
      });
    }, 300);
  }

  addUser(user: SearchUser) {
    this.selectedUsers.set([...this.selectedUsers(), user]);
    this.searchResults.set([]);
    this.searchQuery = '';
  }

  removeSelected(userId: string) {
    this.selectedUsers.set(this.selectedUsers().filter(u => u.id !== userId));
  }

  removeShare(userId: string) {
    this.albumService.unshareAlbum(this.albumId, userId).subscribe({
      next: () => {
        this.currentShares.set(this.currentShares().filter(s => s.userId !== userId));
      },
      error: () => {
        this.errorMessage.set('Failed to remove access.');
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  async saveShares() {
    const toShare = [...this.selectedUsers()];
    if (toShare.length === 0) return;

    this.saving.set(true);
    this.errorMessage.set('');

    let failed = 0;
    for (const user of toShare) {
      try {
        await this.albumService.shareAlbum(this.albumId, user.id).toPromise();
        this.currentShares.set([...this.currentShares(), { userId: user.id, userName: user.name }]);
      } catch {
        failed++;
      }
    }

    this.selectedUsers.set([]);
    this.saving.set(false);
    if (failed > 0) this.errorMessage.set(`${failed} user(s) could not be added.`);
  }

  close() {
    this.closed.emit();
  }
}
