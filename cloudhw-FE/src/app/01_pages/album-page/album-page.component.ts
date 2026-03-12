import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService } from '../../03_services/album.service';
import { PictureService } from '../../03_services/picture.service';
import { UserService } from '../../03_services/user.service';
import { UploadService, SelectedFile } from '../../03_services/upload.service';
import { Album } from '../../04_models/album.model';
import { Picture } from '../../04_models/picture.model';
import { ShareAlbumModalComponent } from '../../02_components/share-album-modal/share-album-modal.component';
import { AlbumHeaderComponent } from '../../02_components/album-header/album-header.component';
import { PictureGridComponent } from '../../02_components/picture-grid/picture-grid.component';

@Component({
  selector: 'app-album-page',
  standalone: true,
  imports: [...SHARED_IMPORTS, ShareAlbumModalComponent, AlbumHeaderComponent, PictureGridComponent],
  templateUrl: './album-page.component.html',
  styleUrls: ['./album-page.component.css']
})
export class AlbumPageComponent implements OnInit, OnDestroy {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private albumService    = inject(AlbumService);
  private pictureService  = inject(PictureService);
  private userService     = inject(UserService);
  uploadService           = inject(UploadService);

  // ── State ─────────────────────────────────────────────────────────
  album              = signal<Album | null>(null);
  pictures           = signal<Picture[]>([]);
  loading            = signal(true);
  thumbnailUrls      = signal<Record<string, string>>({});
  toastMessage       = signal('');
  errorMessage       = signal('');
  togglingVisibility = signal(false);
  downloading        = signal(false);
  confirmingDelete   = signal(false);
  sharingAlbum       = signal<Album | null>(null);

  private unsubUploadComplete: (() => void) | null = null;
  private thumbnailRequestSeq = 0;

  isOwner = computed(() => {
    const album = this.album();
    const user  = this.userService.currentUser();
    return !!album && !!user && album.ownerId === user.id;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
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
    Object.values(this.thumbnailUrls()).forEach(url => URL.revokeObjectURL(url));
  }

  // ── Data loading ──────────────────────────────────────────────────
  private loadAlbum(id?: string) {
    const albumId = id ?? this.album()?.id;
    if (!albumId) return;
    this.albumService.getAlbum(albumId).subscribe({
      next:  (album) => { this.album.set(album); this.loading.set(false); },
      error: ()      => { this.loading.set(false); this.errorMessage.set('Album not found.'); }
    });
  }

  private loadPictures(id?: string) {
    const albumId = id ?? this.album()?.id;
    if (!albumId) return;
    this.pictureService.getAlbumPictures(albumId).subscribe({
      next:  (pics) => { this.pictures.set(pics); this.loadThumbnails(pics); },
      error: ()     => {}
    });
  }

  private loadThumbnails(pics: Picture[]): void {
    if (pics.length === 0) return;
    const requestSeq = ++this.thumbnailRequestSeq;
    // Don't clear thumbnails yet — only replace them when new ones arrive successfully
    this.pictureService.getAlbumThumbnails(pics[0].albumId).subscribe({
      next: (thumbnails) => {
        if (requestSeq !== this.thumbnailRequestSeq) return;
        // Revoke old URLs only after we have the new ones ready
        const oldUrls = this.thumbnailUrls();
        Object.values(oldUrls).forEach(url => URL.revokeObjectURL(url));
        // Now set the new thumbnails
        const urls: Record<string, string> = {};
        for (const t of thumbnails) {
          if (!t.thumbnail) continue;
          urls[t.id] = `data:image/jpeg;base64,${t.thumbnail}`;
        }
        this.thumbnailUrls.set(urls);
      },
      error: (err) => {
        if (requestSeq !== this.thumbnailRequestSeq) return;
        // Silently fail — pictures will show placeholders, which is better than disappearing
        console.warn('Failed to load thumbnails:', err);
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────
  goBack() {
    const a = this.album();
    this.router.navigate(a ? ['/profile', a.ownerId] : ['/']);
  }

  // ── Visibility ────────────────────────────────────────────────────
  toggleVisibility(): void {
    const album = this.album();
    if (!album || this.togglingVisibility()) return;
    this.togglingVisibility.set(true);
    const newPublic = !album.isPublic;
    this.albumService.updateAlbum(album.id, { name: album.name, description: album.description, isPublic: newPublic }).subscribe({
      next:  (updated) => { this.album.set(updated); this.togglingVisibility.set(false); this.showToast(newPublic ? 'Album is now public' : 'Album is now private'); },
      error: ()        => { this.togglingVisibility.set(false); this.errorMessage.set('Failed to update visibility.'); }
    });
  }

  // ── Delete album ──────────────────────────────────────────────────
  confirmDeleteAlbum()  { this.confirmingDelete.set(true); }
  cancelDeleteAlbum()   { this.confirmingDelete.set(false); }

  deleteAlbum() {
    const a = this.album();
    if (!a) return;
    this.albumService.deleteAlbum(a.id).subscribe({
      next:  () => this.router.navigate(['/profile', a.ownerId]),
      error: () => { this.errorMessage.set('Failed to delete album.'); this.confirmingDelete.set(false); }
    });
  }

  // ── Download ──────────────────────────────────────────────────────
  downloadAlbum(): void {
    const a = this.album();
    if (!a || this.downloading()) return;
    this.downloading.set(true);
    this.albumService.downloadAlbumZip(a.id).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `${a.name}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.downloading.set(false);
        this.showToast('Download started!');
      },
      error: () => { this.downloading.set(false); this.errorMessage.set('Failed to download album.'); }
    });
  }

  // ── Share ─────────────────────────────────────────────────────────
  openShareModal()  { this.sharingAlbum.set(this.album()); }
  closeShareModal() { this.sharingAlbum.set(null); }

  copyShareLink(): void {
    navigator.clipboard.writeText(window.location.href)
      .then(()  => this.showToast('Link copied to clipboard!'))
      .catch(() => this.errorMessage.set('Failed to copy link.'));
  }

  // ── PictureGrid output handlers ───────────────────────────────────
  onPictureDeleted(pic: Picture): void {
    this.pictures.set(this.pictures().filter(p => p.id !== pic.id));
    const a = this.album();
    if (a) {
      this.album.set({
        ...a,
        pictureCount:   a.pictureCount - 1,
        size:           a.size - pic.size,
        coverPictureId: a.coverPictureId === pic.id ? undefined : a.coverPictureId
      });
    }
    const urls = { ...this.thumbnailUrls() };
    if (urls[pic.id]) { URL.revokeObjectURL(urls[pic.id]); delete urls[pic.id]; this.thumbnailUrls.set(urls); }
    this.showToast(`"${this.trimName(pic.name)}" deleted.`);
  }

  onCoverSet(picId: string): void {
    const a = this.album();
    if (!a) return;
    this.album.set({ ...a, coverPictureId: picId });
    const pic = this.pictures().find(p => p.id === picId);
    this.albumService.setCoverPicture(a.id, picId).subscribe({
      next: () => this.showToast(pic ? `Cover set to "${this.trimName(pic.name)}".` : 'Cover updated.'),
      error: () => {
        this.album.set(a); // Revert on error
        this.errorMessage.set('Failed to set cover picture.');
      }
    });
  }

  onRenamed(event: { id: string; name: string }): void {
    this.pictures.set(this.pictures().map(p => p.id === event.id ? { ...p, name: event.name } : p));
    this.showToast(`Photo renamed to "${this.trimName(event.name)}".`);
  }

  // ── AlbumHeader output handlers ───────────────────────────────────
  onFilesSelected(files: FileList): void {
    this.addFiles(Array.from(files));
  }

  onFilesDropped(files: File[]): void {
    this.addFiles(files);
  }

  private addFiles(files: File[]): void {
    const a = this.album();
    if (!a) return;
    const selected: SelectedFile[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => {
        const trimmedName = this.trimPictureName(f.name);
        const file = trimmedName !== f.name ? new File([f], trimmedName, { type: f.type }) : f;
        return { file, preview: URL.createObjectURL(f), name: trimmedName, size: f.size };
      });
    if (selected.length === 0) return;
    this.uploadService.uploadFiles(this.pictureService, this.albumService, a.id, a.name, selected, null);
    this.showToast(`Uploading ${selected.length} photo${selected.length === 1 ? '' : 's'}...`);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  trimName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }

  private trimPictureName(name: string, max = 40): string {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return name.length > max ? name.substring(0, max) : name;
    const base = name.substring(0, dot);
    const ext  = name.substring(dot);
    return (base.length > max ? base.substring(0, max) : base) + ext;
  }

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}