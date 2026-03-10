import {
  Component,
  HostListener,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { AlbumService } from '../../03_services/album.service';
import { GlobalSearchService } from '../../03_services/global-search.service';
import { PictureService } from '../../03_services/picture.service';
import { UserService } from '../../03_services/user.service';
import { Album } from '../../04_models/album.model';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.css'],
})
export class GlobalSearchComponent implements OnInit, OnDestroy, AfterViewChecked {
  private albumService = inject(AlbumService);
  private searchService = inject(GlobalSearchService);
  private pictureService = inject(PictureService);
  private userService = inject(UserService);
  private router = inject(Router);

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly isMac = navigator.platform.toUpperCase().includes('MAC') ||
    navigator.userAgent.toUpperCase().includes('MAC');
  readonly searchShortcut = this.isMac ? '⌘K' : 'Ctrl+K';

  isOpen = this.searchService.isOpen;
  query = signal('');
  results = signal<Album[]>([]);
  loading = signal(false);
  activeIndex = signal(-1);
  coverUrls = signal<Record<string, string>>({});

  private querySubject = new Subject<string>();
  private sub = new Subscription();
  private wasOpen = false;
  private shouldFocusInput = false;

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        this.query.set('');
        this.results.set([]);
        this.activeIndex.set(-1);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.sub.add(
      this.querySubject.pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          if (!q.trim()) {
            this.results.set([]);
            this.loading.set(false);
            return of([]);
          }
          return this.albumService.searchAlbums(q).pipe(
            catchError(() => {
              this.loading.set(false);
              return of([]);
            })
          );
        })
      ).subscribe(albums => {
        this.results.set(albums);
        this.loading.set(false);
        this.activeIndex.set(-1);
        this.loadCovers(albums);
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    Object.values(this.coverUrls()).forEach(url => URL.revokeObjectURL(url));
  }

  ngAfterViewChecked() {
    const open = this.isOpen();
    if (!this.wasOpen && open) {
      this.shouldFocusInput = true;
    }
    this.wasOpen = open;

    if (this.shouldFocusInput && this.searchInputRef) {
      this.searchInputRef.nativeElement.focus();
      this.shouldFocusInput = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.open();
      return;
    }

    if (!this.isOpen()) return;

    if (event.key === 'Escape') {
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const max = this.results().length - 1;
      this.activeIndex.set(Math.min(this.activeIndex() + 1, max));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const idx = this.activeIndex();
      const list = this.results();
      if (idx >= 0 && idx < list.length) {
        this.selectAlbum(list[idx]);
      }
      return;
    }
  }

  open() {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.searchService.open();
  }

  close() {
    this.searchService.close();
  }

  onQueryChange(value: string) {
    this.query.set(value);
    this.activeIndex.set(-1);
    this.loading.set(!!value.trim());
    this.querySubject.next(value);
  }

  selectAlbum(album: Album) {
    this.close();
    this.router.navigate(['/album', album.id]);
  }

  getCoverUrl(album: Album): string | null {
    return this.coverUrls()[album.id] ?? null;
  }

  isSharedWithMe(album: Album): boolean {
    const me = this.userService.currentUser();
    if (!me) return false;
    return !album.isPublic && album.ownerId !== me.id;
  }

  isPrivateMine(album: Album): boolean {
    const me = this.userService.currentUser();
    if (!me) return false;
    return !album.isPublic && album.ownerId === me.id;
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('gs-backdrop')) {
      this.close();
    }
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
}
