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
import { SHARED_IMPORTS } from '../../shared.imports';
import { Router } from '@angular/router';
import { Subject, Subscription, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { AlbumService } from '../../03_services/album.service';
import { GlobalSearchService } from '../../03_services/global-search.service';
import { PictureService } from '../../03_services/picture.service';
import { UserService } from '../../03_services/user.service';
import { Album } from '../../04_models/album.model';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [...SHARED_IMPORTS],
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
  userResults = signal<{ id: string; name: string; email: string }[]>([]);
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
        this.userResults.set([]);
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
            this.userResults.set([]);
            this.loading.set(false);
            return of({ albums: [] as Album[], users: [] as { id: string; name: string; email: string }[] });
          }
          return forkJoin({
            albums: this.albumService.searchAlbums(q).pipe(catchError(() => of<Album[]>([]))),
            users: this.userService.searchUsers(q).pipe(catchError(() => of<{ id: string; name: string; email: string }[]>([])))
          });
        })
      ).subscribe(({ albums, users }) => {
        this.results.set(albums);
        this.userResults.set(users);
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
      const max = this.results().length + this.userResults().length - 1;
      this.activeIndex.set(Math.min(this.activeIndex() + 1, Math.max(0, max)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const idx = this.activeIndex();
      const albums = this.results();
      const users = this.userResults();
      if (idx >= 0 && idx < albums.length) {
        this.selectAlbum(albums[idx]);
      } else if (idx >= albums.length && idx < albums.length + users.length) {
        this.selectUser(users[idx - albums.length]);
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

  selectUser(user: { id: string; name: string; email: string }) {
    this.close();
    this.router.navigate(['/profile', user.id]);
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
