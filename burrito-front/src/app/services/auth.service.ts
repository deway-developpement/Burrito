import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { tap, catchError, of } from 'rxjs';
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

    const headers = new HttpHeaders().set('refresh_token', refreshToken);

    return this.http
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
        catchError((err) => {
          this.logout(); 
          return of(null);
        })
      );
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  setCurrentUser(user: User | null): void {
    this.currentUser.set(user);
  }

  logout() {
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('refresh_token');
  }
}
