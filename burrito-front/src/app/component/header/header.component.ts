import { Component, LOCALE_ID, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../shared/button/button.component';
import { UserService } from '../../services/user.service'; 
import { AuthService } from '../../services/auth.service'; 

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, ButtonComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  // Inject the service to access state
  readonly userService = inject(UserService);
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private localeId = inject(LOCALE_ID);

  // UI state for resend action
  isResending = signal(false);
  resendStatus = signal<'idle' | 'success' | 'error'>('idle');
  bannerDismissed = signal(false);
  showSuccessModal = signal(false);

  locales = ['en', 'fr', 'de', 'es'];

  logout() {
    // Calling the cleanup method we saw in your service earlier
    // allows the UI to update immediately for testing
    this.userService.clearUserData();
    this.authService.logout();
    console.log('Logout clicked');
    this.router.navigate(['/']);
  }

  resendVerification() {
    this.isResending.set(true);
    this.resendStatus.set('idle');
    this.userService.resendEmailVerification().subscribe({
      next: () => {
        this.isResending.set(false);
        this.bannerDismissed.set(true);
        this.showSuccessModal.set(true);
      },
      error: () => {
        this.isResending.set(false);
        this.resendStatus.set('error');
      },
    });
  }

  dismissBanner() {
    this.bannerDismissed.set(true);
  }

  closeModal() {
    this.showSuccessModal.set(false);
  }

  get activeLocale(): string {
    if (isPlatformBrowser(this.platformId)) {
      const segments = this.document.location.pathname.split('/').filter(Boolean);
      const pathLocale = this.getLocaleFromPath(segments[0]);
      if (pathLocale) {
        return pathLocale;
      }
    }
    return this.normalizeLocale(this.localeId);
  }

  onLocaleChange(nextLocale: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const { pathname, search, hash } = this.document.location;
    const segments = pathname.split('/').filter(Boolean);
    const currentLocale = this.getLocaleFromPath(segments[0]);

    if (currentLocale) {
      segments.shift();
    }

    if (nextLocale !== 'en') {
      segments.unshift(nextLocale);
    }

    let nextPath = `/${segments.join('/')}`;
    if (segments.length === 0) {
      nextPath = '/';
    }
    if (segments.length === 1 && this.locales.includes(segments[0])) {
      nextPath = `/${segments[0]}/`;
    }
    this.document.location.assign(`${nextPath}${search}${hash}`);
  }

  private normalizeLocale(localeId: string): string {
    if (localeId.startsWith('fr')) {
      return 'fr';
    }
    if (localeId.startsWith('de')) {
      return 'de';
    }
    if (localeId.startsWith('es')) {
      return 'es';
    }
    return 'en';
  }

  private getLocaleFromPath(segment?: string): string | null {
    if (!segment) {
      return null;
    }
    return this.locales.includes(segment) ? segment : null;
  }
}

