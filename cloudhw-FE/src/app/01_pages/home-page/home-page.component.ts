import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlbumService } from '../../03_services/album.service';
import { PictureService } from '../../03_services/picture.service';
import { Album } from '../../04_models/album.model';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
})
export class HomePageComponent implements OnInit, OnDestroy {
  private albumService = inject(AlbumService);
  private pictureService = inject(PictureService);
  private router = inject(Router);

  loading = signal(true);
  allAlbums = signal<Album[]>([]);
  coverUrls = signal<Record<string, string>>({});
  currentPage = signal(1);

  totalPages = computed(() => Math.max(1, Math.ceil(this.allAlbums().length / PAGE_SIZE)));

  pageAlbums = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.allAlbums().slice(start, start + PAGE_SIZE);
  });

  pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  ngOnInit() {
    this.albumService.getPublicAlbums().subscribe({
      next: (albums) => {
        this.allAlbums.set(albums);
        this.loading.set(false);
        this.loadCovers(albums.slice(0, PAGE_SIZE));
      },
      error: () => this.loading.set(false)
    });
  }

  ngOnDestroy() {
    Object.values(this.coverUrls()).forEach(url => URL.revokeObjectURL(url));
  }

  private loadCovers(albums: Album[]) {
    const toLoad = albums.filter(a => a.coverPictureId && !this.coverUrls()[a.id]);
    for (const album of toLoad) {
      this.pictureService.getThumbnailBlob(album.coverPictureId!).subscribe({
        next: (blob) => {
          this.coverUrls.update(urls => ({ ...urls, [album.id]: URL.createObjectURL(blob) }));
        }
      });
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    const start = (page - 1) * PAGE_SIZE;
    this.loadCovers(this.allAlbums().slice(start, start + PAGE_SIZE));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navigateToAlbum(album: Album) {
    this.router.navigate(['/album', album.id], { queryParams: { returnUrl: this.router.url } });
  }

  navigateToUser(album: Album, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/profile', album.ownerId]);
  }

  getCoverUrl(album: Album): string | null {
    return this.coverUrls()[album.id] || null;
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
