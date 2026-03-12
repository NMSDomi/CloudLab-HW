import {
  Component, input, output, computed, signal,
  HostListener, ViewChild, ElementRef, OnDestroy, AfterViewChecked, inject
} from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';
import { Picture } from '../../04_models/picture.model';
import { Album } from '../../04_models/album.model';
import { PictureService } from '../../03_services/picture.service';
import { MasonryLayoutService } from '../../03_services/masonry-layout.service';

type SortField = 'name' | 'createdAt' | 'size';
type SortDir   = 'asc'  | 'desc';

@Component({
  selector: 'app-picture-grid',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './picture-grid.component.html',
  styleUrls: ['./picture-grid.component.css']
})
export class PictureGridComponent implements AfterViewChecked, OnDestroy {
  private pictureService = inject(PictureService);
  private masonryService = inject(MasonryLayoutService);
  private el            = inject(ElementRef);

  // ── Inputs ──────────────────────────────────────────────────────────────
  pictures      = input.required<Picture[]>();
  album         = input.required<Album>();
  isOwner       = input(false);
  thumbnailUrls = input<Record<string, string>>({});

  // ── Outputs ─────────────────────────────────────────────────────────────
  pictureDeleted = output<Picture>();
  coverSet       = output<string>();
  renamed        = output<{ id: string; name: string }>();
  filesDropped   = output<File[]>();

  // ── Sort ─────────────────────────────────────────────────────────────────
  sortField = signal<SortField>('name');
  sortDir   = signal<SortDir>('asc');

  // ── Lightbox ─────────────────────────────────────────────────────────────
  lightboxPic     = signal<Picture | null>(null);
  lightboxUrl     = signal<string | null>(null);
  lightboxLoading = signal(false);

  // ── Rename ───────────────────────────────────────────────────────────────
  renamingPicId = signal<string | null>(null);
  renameSaving  = signal(false);
  renameValue   = '';

  // ── Delete confirm ────────────────────────────────────────────────────────
  deletingPic = signal<Picture | null>(null);
  deleteDeleting = signal(false);

  // ── Drag & drop ──────────────────────────────────────────────────────────
  dragOver = signal(false);

  // ── Masonry / layout ─────────────────────────────────────────────────────
  @ViewChild('gridContainer') private gridContainerRef?: ElementRef<HTMLElement>;
  private masonryMeasured = false;
  private resizeObserver?: ResizeObserver;
  private dimensionCorrectionTimer: any;
  private pendingCorrections: Record<string, { width: number; height: number }> = {};

  /** Local corrections for thumbnail-revealed dimensions (no parent needed) */
  private correctedDims = signal<Record<string, { width: number; height: number }>>({});

  containerWidth = signal(0);

  sortedPictures = computed(() => {
    const pics = this.pictures().map(p => {
      const c = this.correctedDims()[p.id];
      return c ? { ...p, ...c } : p;
    });
    const field = this.sortField();
    const dir   = this.sortDir();
    const mult  = dir === 'asc' ? 1 : -1;
    pics.sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'createdAt':
          return mult * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        case 'size':
          return mult * (a.size - b.size);
        default:
          return 0;
      }
    });
    return pics;
  });

  masonryLayout = computed(() =>
    this.masonryService.computeLayout(this.sortedPictures(), this.containerWidth())
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngAfterViewChecked() {
    if (!this.masonryMeasured) this.measureContainer();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    clearTimeout(this.dimensionCorrectionTimer);
    const lbUrl = this.lightboxUrl();
    if (lbUrl) URL.revokeObjectURL(lbUrl);
  }

  // ── Container measurement ─────────────────────────────────────────────────
  @HostListener('window:resize')
  onWindowResize() { this.measureContainer(); }

  private measureContainer() {
    const el = this.gridContainerRef?.nativeElement;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) {
      this.containerWidth.set(w);
      this.masonryMeasured = true;
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          for (const entry of entries) {
            const nw = entry.contentRect.width;
            if (nw > 0 && Math.abs(nw - this.containerWidth()) > 1) {
              this.containerWidth.set(nw);
            }
          }
        });
        this.resizeObserver.observe(el);
      }
    }
  }

  onThumbnailLoad(event: Event, pic: Picture) {
    const img = event.target as HTMLImageElement;
    if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) return;
    const storedAR = pic.width > 0 && pic.height > 0 ? pic.width / pic.height : 0;
    const actualAR = img.naturalWidth / img.naturalHeight;
    if (storedAR === 0 || Math.abs(storedAR - actualAR) > 0.1) {
      this.pendingCorrections[pic.id] = { width: img.naturalWidth, height: img.naturalHeight };
      clearTimeout(this.dimensionCorrectionTimer);
      this.dimensionCorrectionTimer = setTimeout(() => this.applyDimensionCorrections(), 100);
    }
  }

  private applyDimensionCorrections() {
    const c = this.pendingCorrections;
    if (Object.keys(c).length === 0) return;
    this.correctedDims.set({ ...this.correctedDims(), ...c });
    this.pendingCorrections = {};
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.lightboxPic()) return;
    if (event.key === 'Escape')     this.closeLightbox();
    if (event.key === 'ArrowLeft')  this.navigateLightbox(-1);
    if (event.key === 'ArrowRight') this.navigateLightbox(1);
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────
  openLightbox(pic: Picture) {
    this.lightboxPic.set(pic);
    this.lightboxUrl.set(null);
    this.lightboxLoading.set(true);
    this.pictureService.getPictureBlob(pic.id).subscribe({
      next: blob => {
        this.lightboxUrl.set(URL.createObjectURL(blob));
        this.lightboxLoading.set(false);
      },
      error: () => this.lightboxLoading.set(false)
    });
  }

  closeLightbox() {
    const url = this.lightboxUrl();
    if (url) URL.revokeObjectURL(url);
    this.lightboxPic.set(null);
    this.lightboxUrl.set(null);
  }

  navigateLightbox(direction: number) {
    const pics    = this.sortedPictures();
    const current = this.lightboxPic();
    if (!current || pics.length === 0) return;
    const idx    = pics.findIndex(p => p.id === current.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= pics.length) return;
    this.openLightbox(pics[newIdx]);
  }

  downloadLightbox() {
    const url = this.lightboxUrl();
    const pic = this.lightboxPic();
    if (!url || !pic) return;
    const a = document.createElement('a');
    a.href = url; a.download = pic.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  get lightboxHasPrev(): boolean {
    const c = this.lightboxPic();
    return !!c && this.sortedPictures().findIndex(p => p.id === c.id) > 0;
  }

  get lightboxHasNext(): boolean {
    const c = this.lightboxPic();
    if (!c) return false;
    const pics = this.sortedPictures();
    return pics.findIndex(p => p.id === c.id) < pics.length - 1;
  }

  // ── Picture actions (emitted to parent) ───────────────────────────────────
  onDeletePicture(pic: Picture, event: Event) {
    event.stopPropagation();
    this.deletingPic.set(pic);
  }

  cancelDelete() {
    this.deletingPic.set(null);
  }

  confirmDelete() {
    const pic = this.deletingPic();
    if (!pic) return;
    this.deleteDeleting.set(true);
    // Emit immediately — the parent handles the actual API call;
    // once the input `pictures` signal updates, the card disappears.
    this.pictureDeleted.emit(pic);
    this.deletingPic.set(null);
    this.deleteDeleting.set(false);
  }

  onSetCover(pic: Picture, event: Event) {
    event.stopPropagation();
    this.coverSet.emit(pic.id);
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  startRename(pic: Picture, event: Event) {
    event.stopPropagation();
    // Scroll the tile to the center of the viewport instantly so it sits
    // directly behind the fixed modal backdrop when it opens.
    const tile = this.el.nativeElement.querySelector(`[data-pic-id="${pic.id}"]`) as HTMLElement | null;
    tile?.scrollIntoView({ behavior: 'instant', block: 'center' });
    this.renameValue = this.trimName(pic.name);
    this.renamingPicId.set(pic.id);
  }

  cancelRename() {
    this.renamingPicId.set(null);
    this.renameValue = '';
  }

  submitRename() {
    const picId = this.renamingPicId();
    if (!picId) return;
    const raw = this.renameValue.trim();
    if (!raw || raw.length > 40) return;
    const pic = this.pictures().find(p => p.id === picId);
    if (!pic) return;
    const dot = pic.name.lastIndexOf('.');
    const ext = dot > 0 ? pic.name.substring(dot) : '';
    this.renameSaving.set(true);
    this.pictureService.renamePicture(picId, raw + ext).subscribe({
      next: updated => {
        this.renamed.emit(updated);
        this.renameSaving.set(false);
        this.renamingPicId.set(null);
        this.renameValue = '';
      },
      error: () => this.renameSaving.set(false)
    });
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────
  onDragOver(event: DragEvent)  { event.preventDefault(); event.stopPropagation(); this.dragOver.set(true); }
  onDragLeave(event: DragEvent) { event.preventDefault(); event.stopPropagation(); this.dragOver.set(false); }

  onDrop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); this.dragOver.set(false);
    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) this.filesDropped.emit(files);
    }
  }

  onFilesSelectedFromInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) this.filesDropped.emit(files);
      input.value = '';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  trimName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
}
