import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // If user is already logged in, redirect to home
  if (authService.token()) {
    router.navigate(['/']);
    return false;
  }

  // If there's a refresh token, they might still be authenticated
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    router.navigate(['/']);
    return false;
  }

  // Not logged in, allow access to sign-in page
  return true;
};
