import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { tap, catchError, of, shareReplay, finalize, Observable } from 'rxjs';
import { getApiBaseUrl } from '../config/runtime-config';

interface AuthResponse {
  access_token: string;
  refresh_token: string; 
}

interface User {
  id: string;
  email: string;
  fullName: string;
  userType: 'ADMIN' | 'TEACHER' | 'STUDENT';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = getApiBaseUrl();
  private refreshInFlight$: Observable<AuthResponse | null> | null = null;
  
  // Signal for the short-lived Access Token
  token = signal<string | null>(null);
  
  // Signal for current user
  currentUser = signal<User | null>(null);

  login(credentials: { email: string; password: string }) {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
      tap((response) => {
        // 1. Update Access Token
        this.token.set(response.access_token);

        // 2. Store Refresh Token locally
        localStorage.setItem('refresh_token', response.refresh_token);
      })
    );
  }

  refreshSession() {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      this.token.set(null);
      return of(null);
    }
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const headers = new HttpHeaders().set('refresh_token', refreshToken);

    this.refreshInFlight$ = this.http
      .get<AuthResponse>(`${this.apiBaseUrl}/auth/refresh`, {
        headers,
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this.token.set(response.access_token);

          if (response.refresh_token) {
            localStorage.setItem('refresh_token', response.refresh_token);
          }
        }),
        catchError((err: unknown) => {
          const status =
            err instanceof HttpErrorResponse ? err.status : undefined;
          if (status === 401 || status === 403) {
            this.logout();
          }
          return of(null);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );
    return this.refreshInFlight$;
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  setCurrentUser(user: User | null): void {
    this.currentUser.set(user);
  }

  logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const headers = new HttpHeaders().set('refresh_token', refreshToken);
      // Best-effort server-side session revocation.
      this.http
        .post(`${this.apiBaseUrl}/auth/logout`, {}, { headers, withCredentials: true })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('refresh_token');
  }
}
