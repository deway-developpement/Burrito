import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (authService.token()) {
    return true;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    router.navigate(['/sign-in'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  return authService.refreshSession().pipe(
    map(() => {
      if (authService.token()) {
        return true;
      } else {
        router.navigate(['/sign-in'], { 
          queryParams: { returnUrl: state.url } 
        });
        return false;
      }
    }),
    catchError(() => {
      router.navigate(['/sign-in'], { 
        queryParams: { returnUrl: state.url } 
      });
      return of(false);
    })
  );
};
