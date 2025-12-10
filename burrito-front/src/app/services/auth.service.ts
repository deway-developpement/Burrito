import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { tap, catchError, of } from 'rxjs';

interface AuthResponse {
  access_token: string;
  refresh_token: string; 
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  
  // Signal for the short-lived Access Token
  token = signal<string | null>(null);

  login(credentials: { email: string; password: string }) {
    return this.http.post<AuthResponse>('/auth/login', credentials).pipe(
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

    // ✅ CORRECTION BASED ON SCREENSHOT
    // We set the header key to 'refresh_token'
    // We send just the token (no 'Bearer ' prefix needed for custom headers usually)
    const headers = new HttpHeaders().set('refresh_token', refreshToken);

    return this.http.get<AuthResponse>('/auth/refresh', { headers }).pipe(
      tap((response) => {
        console.log('Session restored!');
        
        this.token.set(response.access_token);

        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }
      }),
      catchError((err) => {
        console.log('Refresh failed', err);
        this.logout(); 
        return of(null);
      })
    );
  }

  logout() {
    this.token.set(null);
    localStorage.removeItem('refresh_token');
  }
}