import { Component, computed, inject, output, HostListener, ElementRef } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';
import { Router } from '@angular/router';
import { UserService } from '../../03_services/user.service';
import { GlobalSearchService } from '../../03_services/global-search.service';
import { ThemeService } from '../../03_services/theme.service';
import { LanguageService } from '../../03_services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private searchService = inject(GlobalSearchService);
  readonly themeService = inject(ThemeService);
  isDark = this.themeService.isDark;
  readonly langService = inject(LanguageService);

  readonly isMac = navigator.platform.toUpperCase().includes('MAC') ||
    navigator.userAgent.toUpperCase().includes('MAC');
  readonly searchShortcut = this.isMac ? '⌘K' : 'Ctrl+K';

  dropdownOpen = false;
  langDropdownOpen = false;

  private elRef = inject(ElementRef);

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null) {
    if (target instanceof HTMLElement && !this.elRef.nativeElement.contains(target)) {
      this.langDropdownOpen = false;
    }
  }

  uploadClicked = output<void>();

  currentUser = this.userService.currentUser;

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return u.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  onUpload() {
    this.uploadClicked.emit();
  }

  openSearch() {
    this.searchService.open();
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  toggleLang() {
    this.langService.toggleLang();
  }

  onLogin() {
    this.router.navigate(['/login']);
  }

  onLogout() {
    this.userService.logout().subscribe();
    this.router.navigate(['/login']);
  }
}

