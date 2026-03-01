import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService } from '../../03_services/album.service';
import { PictureService } from '../../03_services/picture.service';
import { UserService } from '../../03_services/user.service';
import { UploadService, SelectedFile } from '../../03_services/upload.service';
import { Album } from '../../04_models/album.model';
import { Picture } from '../../04_models/picture.model';
import { environmentUrls } from '../../../enviroment/enviroment';
import { catchError, EMPTY, from, map, mergeMap } from 'rxjs';

type SortField = 'name' | 'createdAt' | 'size';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-album-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './album-page.component.html',
  styleUrls: ['./album-page.component.css']
})
export class AlbumPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private albumService = inject(AlbumService);
  private pictureService = inject(PictureService);
  private userService = inject(UserService);
  private http = inject(HttpClient);
  uploadService = inject(UploadService);

  album = signal<Album | null>(null);
  pictures = signal<Picture[]>([]);
  loading = signal(true);
  picturesLoading = signal(true);
  thumbnailUrls = signal<Record<string, string>>({});

  sortField = signal<SortField>('name');
  sortDir = signal<SortDir>('asc');

  toastMessage = signal('');
  errorMessage = signal('');
  togglingVisibility = signal(false);

  // Lightbox
  lightboxPic = signal<Picture | null>(null);
  lightboxUrl = signal<string | null>(null);
  lightboxLoading = signal(false);

  // Upload more photos
  dragOver = signal(false);
  selectedFiles = signal<SelectedFile[]>([]);
  confirmingDelete = signal(false);

  private unsubUploadComplete: (() => void) | null = null;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.lightboxPic()) return;
    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case 'ArrowLeft':
        this.navigateLightbox(-1);
        break;
      case 'ArrowRight':
        this.navigateLightbox(1);
        break;
    }
  }

  isOwner = computed(() => {
    const album = this.album();
    const user = this.userService.currentUser();
    return !!album && !!user && album.ownerId === user.id;
  });

  toggleVisibility(): void {
    const album = this.album();
    if (!album || this.togglingVisibility()) return;
    this.togglingVisibility.set(true);
    const newPublic = !album.isPublic;
    this.albumService.updateAlbum(album.id, {
      name: album.name,
      description: album.description,
      isPublic: newPublic
    }).subscribe({
      next: (updated) => {
        this.album.set(updated);
        this.togglingVisibility.set(false);
        this.showToast(newPublic ? 'Album is now public' : 'Album is now private');
      },
      error: () => {
        this.togglingVisibility.set(false);
        this.errorMessage.set('Failed to update visibility.');
      }
    });
  }

  sortedPictures = computed(() => {
    const pics = [...this.pictures()];
    const field = this.sortField();
    const dir = this.sortDir();
    const mult = dir === 'asc' ? 1 : -1;

    pics.sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'createdAt':
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'size':
          return mult * (a.size - b.size);
        default:
          return 0;
      }
    });
    return pics;
  });

  ngOnInit() {
    this.unsubUploadComplete = this.uploadService.onComplete(() => {
      this.loadAlbum();
      this.loadPictures();
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;
      this.loadAlbum(id);
      this.loadPictures(id);
    });
  }

  ngOnDestroy() {
    if (this.unsubUploadComplete) this.unsubUploadComplete();
    // Revoke blob URLs
    Object.values(this.thumbnailUrls()).forEach(url => URL.revokeObjectURL(url));
    const lbUrl = this.lightboxUrl();
    if (lbUrl) URL.revokeObjectURL(lbUrl);
  }

  //Only metadata
  private loadAlbum(id?: string) {
    const albumId = id || this.album()?.id;
    if (!albumId) return;

    this.albumService.getAlbum(albumId).subscribe({
      next: (album) => {
        this.album.set(album);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Album not found.');
      }
    });
  }

  //Only metadata
  private loadPictures(id?: string) {
    const albumId = id || this.album()?.id;
    if (!albumId) return;

    this.picturesLoading.set(true);
    this.pictureService.getAlbumPictures(albumId).subscribe({
      next: (pics) => {
        this.pictures.set(pics);
        this.picturesLoading.set(false);
        this.loadThumbnails(pics); //Loading thumbnails for pictures
      },
      error: () => {
        this.picturesLoading.set(false);
      }
    });
  }


  private loadThumbnails(pics: Picture[]): void {
    if (pics.length === 0) return;

    // Előző képek törlése a memóriaszivárgás elkerülésére
    const oldUrls = this.thumbnailUrls();
    Object.values(oldUrls).forEach(url => URL.revokeObjectURL(url));
    this.thumbnailUrls.set({});

    const MAX_CONCURRENT = 6;

    // TODO: Replace with a batch API in the backend to avoid this many requests
    from(pics).pipe(
      // A mergeMap automatikusan limitálja a párhuzamos kérések számát
      mergeMap(pic => 
        this.pictureService.getThumbnailBlob(pic.id).pipe(
          map(blob => ({ id: pic.id, blob })),
          catchError(() => EMPTY) // Hiba esetén (pl. 404) csendben továbblép a következőre
        ), 
        MAX_CONCURRENT 
      )
    ).subscribe({
      next: (result) => {
        const url = URL.createObjectURL(result.blob);
        
        this.thumbnailUrls.update(currentUrls => ({ 
          ...currentUrls, 
          [result.id]: url 
        }));
      }
    });
  }

  getThumbnailUrl(pic: Picture): string | null {
    return this.thumbnailUrls()[pic.id] || null;
  }

  setSort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'name' ? 'asc' : 'desc');
    }
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  setCover(pic: Picture) {
    const a = this.album();
    if (!a) return;

    this.albumService.setCoverPicture(a.id, pic.id).subscribe({
      next: () => {
        this.album.set({ ...a, coverPictureId: pic.id });
        this.showToast(`Cover set to "${pic.name}".`);
      },
      error: () => {
        this.errorMessage.set('Failed to set cover picture.');
      }
    });
  }

  deletePicture(pic: Picture) {
    this.pictureService.deletePicture(pic.id).subscribe({
      next: () => {
        this.pictures.set(this.pictures().filter(p => p.id !== pic.id));
        const a = this.album();
        if (a) {
          this.album.set({
            ...a,
            pictureCount: a.pictureCount - 1,
            size: a.size - pic.size,
            coverPictureId: a.coverPictureId === pic.id ? undefined : a.coverPictureId
          });
        }
        // Revoke thumbnail
        const urls = { ...this.thumbnailUrls() };
        if (urls[pic.id]) {
          URL.revokeObjectURL(urls[pic.id]);
          delete urls[pic.id];
          this.thumbnailUrls.set(urls);
        }
        this.showToast(`"${pic.name}" deleted.`);
      },
      error: () => {
        this.errorMessage.set('Failed to delete picture.');
      }
    });
  }

  goBack() {
    const a = this.album();
    if (a) {
      this.router.navigate(['/profile', a.ownerId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  confirmDeleteAlbum() {
    this.confirmingDelete.set(true);
  }

  cancelDeleteAlbum() {
    this.confirmingDelete.set(false);
  }

  deleteAlbum() {
    const a = this.album();
    if (!a) return;

    this.albumService.deleteAlbum(a.id).subscribe({
      next: () => {
        this.router.navigate(['/profile', a.ownerId]);
      },
      error: () => {
        this.errorMessage.set('Failed to delete album.');
        this.confirmingDelete.set(false);
      }
    });
  }

  // --- Upload more photos ---
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
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
    const a = this.album();
    if (!a) return;

    const selected: SelectedFile[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name, size: f.size }));

    if (selected.length === 0) return;

    this.uploadService.uploadFiles(
      this.pictureService,
      this.albumService,
      a.id,
      a.name,
      selected,
      null
    );

    this.showToast(`Uploading ${selected.length} photo${selected.length === 1 ? '' : 's'}...`);
  }

  //To remove file type
  trimName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }

  openLightbox(pic: Picture): void {
    this.lightboxPic.set(pic);
    this.lightboxUrl.set(null);
    this.lightboxLoading.set(true);

    this.http.get(
      `${environmentUrls.pictures}/${pic.id}/data`,
      { responseType: 'blob' }
    ).subscribe({
      next: (blob) => {
        this.lightboxUrl.set(URL.createObjectURL(blob));
        this.lightboxLoading.set(false);
      },
      error: () => {
        this.lightboxLoading.set(false);
      }
    });
  }

  closeLightbox(): void {
    const url = this.lightboxUrl();
    if (url) URL.revokeObjectURL(url);
    this.lightboxPic.set(null);
    this.lightboxUrl.set(null);
  }

  navigateLightbox(direction: number): void {
    const pics = this.sortedPictures();
    const current = this.lightboxPic();
    if (!current || pics.length === 0) return;

    const idx = pics.findIndex(p => p.id === current.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= pics.length) return;

    this.openLightbox(pics[newIdx]);
  }

  downloadLightbox(): void {
    const url = this.lightboxUrl();
    const pic = this.lightboxPic();
    if (!url || !pic) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = pic.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  get lightboxHasPrev(): boolean {
    const pics = this.sortedPictures();
    const current = this.lightboxPic();
    if (!current) return false;
    return pics.findIndex(p => p.id === current.id) > 0;
  }

  get lightboxHasNext(): boolean {
    const pics = this.sortedPictures();
    const current = this.lightboxPic();
    if (!current) return false;
    const idx = pics.findIndex(p => p.id === current.id);
    return idx < pics.length - 1;
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}
