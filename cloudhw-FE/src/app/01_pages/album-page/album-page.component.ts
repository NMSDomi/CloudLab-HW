import { Component, OnInit, OnDestroy, AfterViewChecked, HostListener, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService } from '../../03_services/album.service';
import { PictureService } from '../../03_services/picture.service';
import { UserService } from '../../03_services/user.service';
import { UploadService, SelectedFile } from '../../03_services/upload.service';
import { Album } from '../../04_models/album.model';
import { Picture } from '../../04_models/picture.model';
import { ShareAlbumModalComponent } from '../../02_components/share-album-modal/share-album-modal.component';

type SortField = 'name' | 'createdAt' | 'size';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-album-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ShareAlbumModalComponent],
  templateUrl: './album-page.component.html',
  styleUrls: ['./album-page.component.css']
})
export class AlbumPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private albumService = inject(AlbumService);
  private pictureService = inject(PictureService);
  private userService = inject(UserService);
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
  sharingAlbum = signal(false);

  private unsubUploadComplete: (() => void) | null = null;

  // Masonry layout
  @ViewChild('gridContainer') private gridContainerRef?: ElementRef<HTMLElement>;
  private masonryMeasured = false;
  private resizeObserver?: ResizeObserver;
  private dimensionCorrectionTimer: any;
  private pendingDimensionCorrections: Record<string, { width: number; height: number }> = {};
  containerWidth = signal(0);

  /**
   * Justified masonry layout engine.
   *
   * Packs pictures into rows so that every row fills the full container width,
   * similar to Google Photos or Flickr's justified-grid layout.
   *
   * Algorithm overview:
   *   1. Accumulate pictures into a pending row buffer one by one.
   *   2. After each addition, compute how wide the row would naturally be at
   *      TARGET_ROW_HEIGHT — i.e. each image drawn at its real aspect ratio.
   *   3. Once the natural width meets or exceeds the container width, the row
   *      is "full": scale every image's width/height uniformly so the row fills
   *      the container exactly (justified), then start a new row.
   *   4. If we reach the last picture while the row is still short (not enough
   *      pictures to fill the width), keep TARGET_ROW_HEIGHT instead of
   *      over-stretching the final partial row.
   *
   * Returns an absolute-position map (left / top / width / height) for every
   * picture id, plus the total layout height needed by the container.
   */
  masonryLayout = computed(() => {
    const pictures = this.sortedPictures();
    const containerWidth = this.containerWidth();

    // Nothing to lay out yet — container hasn't been measured or there are no pictures
    if (!containerWidth || pictures.length === 0) {
      return {
        itemPositions: {} as Record<string, { left: number; top: number; width: number; height: number }>,
        totalHeight: 0
      };
    }

    /** Pixel gap between neighbouring pictures (horizontal and vertical) */
    const ITEM_GAP = 6;

    /**
     * The ideal row height we aim for.
     * Full rows will deviate slightly after justification; partial last rows
     * will use this exact height so they don't stretch awkwardly.
     */
    const TARGET_ROW_HEIGHT = 280;

    /** Absolute-position output map, keyed by picture id */
    const itemPositions: Record<string, { left: number; top: number; width: number; height: number }> = {};

    /** Vertical offset where the next row should start (advances after each committed row) */
    let nextRowTop = 0;

    /**
     * Returns the aspect ratio (width ÷ height) for a picture.
     * Falls back to 4:3 if the picture has no stored dimensions.
     */
    const getAspectRatio = (pic: (typeof pictures)[0]) =>
      pic.width > 0 && pic.height > 0 ? pic.width / pic.height : 4 / 3;

    /**
     * Saves the final pixel positions for a completed row into `itemPositions`
     * and advances `nextRowTop` past the row.
     *
     * @param rowPictures  - pictures belonging to this row
     * @param rowHeight    - the uniform height all pictures in this row will share
     */
    const commitRow = (rowPictures: typeof pictures, rowHeight: number) => {
      let leftOffset = 0;
      for (const pic of rowPictures) {
        // Each picture's width is its aspect ratio × the shared row height
        const itemWidth = rowHeight * getAspectRatio(pic);
        itemPositions[pic.id] = { left: leftOffset, top: nextRowTop, width: itemWidth, height: rowHeight };
        leftOffset += itemWidth + ITEM_GAP;
      }
      nextRowTop += rowHeight + ITEM_GAP;
    };

    /** Buffer of pictures being accumulated for the current row */
    let pendingRowPictures: typeof pictures = [];

    for (let i = 0; i < pictures.length; i++) {
      pendingRowPictures.push(pictures[i]);

      const pendingCount = pendingRowPictures.length;

      /** Sum of aspect ratios for all pending pictures — represents their combined "width units" */
      const combinedAspectRatio = pendingRowPictures.reduce((sum, pic) => sum + getAspectRatio(pic), 0);

      /**
       * How wide this row would be if every picture were drawn at TARGET_ROW_HEIGHT.
       * When this meets the container width, the row is ready to be justified and committed.
       */
      const naturalRowWidth = combinedAspectRatio * TARGET_ROW_HEIGHT + ITEM_GAP * (pendingCount - 1);

      const isLastPicture = i === pictures.length - 1;

      if (naturalRowWidth >= containerWidth || isLastPicture) {
        let finalRowHeight: number;

        if (isLastPicture && naturalRowWidth < containerWidth) {
          // The final row doesn't have enough pictures to fill the width naturally.
          // Use the target height as-is rather than over-stretching the images.
          finalRowHeight = TARGET_ROW_HEIGHT;
        } else {
          // Scale the row height so all pictures together fill the container width exactly.
          // Formula: solve (combinedAR × rowHeight + GAP × (n-1)) = containerWidth for rowHeight
          finalRowHeight = (containerWidth - ITEM_GAP * (pendingCount - 1)) / combinedAspectRatio;
        }

        commitRow(pendingRowPictures, finalRowHeight);
        pendingRowPictures = [];
      }
    }

    // Subtract the trailing gap that was added after the last row
    return { itemPositions, totalHeight: nextRowTop > 0 ? nextRowTop - ITEM_GAP : 0 };
  });

  @HostListener('window:resize')
  onWindowResize() {
    this.measureContainer();
  }

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
        case 'createdAt': { // Fallback to uploadedAt if createdAt is missing, to keep consistent with displayed dates
          const aDate = a.createdAt ?? a.uploadedAt;
          const bDate = b.createdAt ?? b.uploadedAt;
          return mult * (new Date(aDate).getTime() - new Date(bDate).getTime());
        }
        case 'size':
          return mult * (a.size - b.size);
        default:
          return 0;
      }
    });
    return pics;
  });

  ngAfterViewChecked() {
    if (!this.masonryMeasured) {
      this.measureContainer();
    }
  }

  private measureContainer() {
    const el = this.gridContainerRef?.nativeElement;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) {
      this.containerWidth.set(w);
      this.masonryMeasured = true;

      // Use ResizeObserver to track container width changes (e.g. scrollbar appearing)
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          for (const entry of entries) {
            const newW = entry.contentRect.width;
            if (newW > 0 && Math.abs(newW - this.containerWidth()) > 1) {
              this.containerWidth.set(newW);
            }
          }
        });
        this.resizeObserver.observe(el);
      }
    }
  }

  /** Correct masonry AR when thumbnail reveals actual dimensions */
  onThumbnailLoad(event: Event, pic: Picture) {
    const img = event.target as HTMLImageElement;
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    // Only correct if stored dimensions are missing (0) or significantly wrong
    const storedAR = pic.width > 0 && pic.height > 0 ? pic.width / pic.height : 0;
    const actualAR = img.naturalWidth / img.naturalHeight;

    if (storedAR === 0 || Math.abs(storedAR - actualAR) > 0.1) {
      this.pendingDimensionCorrections[pic.id] = {
        width: img.naturalWidth,
        height: img.naturalHeight
      };
      clearTimeout(this.dimensionCorrectionTimer);
      this.dimensionCorrectionTimer = setTimeout(() => this.applyDimensionCorrections(), 100);
    }
  }

  private applyDimensionCorrections() {
    const corrections = this.pendingDimensionCorrections;
    if (Object.keys(corrections).length === 0) return;

    const correctedPics = this.pictures().map(p =>
      corrections[p.id] ? { ...p, ...corrections[p.id] } : p
    );
    this.pictures.set(correctedPics);
    this.pendingDimensionCorrections = {};
  }

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
    this.resizeObserver?.disconnect();
    clearTimeout(this.dimensionCorrectionTimer);
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

    const oldUrls = this.thumbnailUrls();
    Object.values(oldUrls).forEach(url => URL.revokeObjectURL(url));
    this.thumbnailUrls.set({});

    const albumId = pics[0].albumId;
    this.pictureService.getAlbumThumbnails(albumId).subscribe({
      next: (thumbnails) => {
        const urls: Record<string, string> = {};
        for (const t of thumbnails) {
          urls[t.id] = `data:${t.contentType};base64,${t.thumbnail}`;
        }
        this.thumbnailUrls.set(urls);
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
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }
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

  openShareModal() {
    this.sharingAlbum.set(true);
  }

  closeShareModal() {
    this.sharingAlbum.set(false);
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

    this.pictureService.getPictureBlob(pic.id).subscribe({
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

  formatDate(date: string | null | undefined): string {
    if (!date) return 'Unknown';
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