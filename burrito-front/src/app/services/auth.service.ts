import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { tap, catchError, of } from 'rxjs';

interface AuthResponse {
  access_token: string;
  refresh_token: string; 
}

interface User {
  id: string;
  email: string;
  fullName: string;
  userType: 'admin' | 'teacher' | 'student';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  
  // Signal for the short-lived Access Token
  token = signal<string | null>(null);
  
  // Signal for current user
  currentUser = signal<User | null>(null);

  login(credentials: { email: string; password: string }) {
    return this.http.post<AuthResponse>('/auth/login', credentials).pipe(
      tap((response) => {
        // 1. Update Access Token
        this.token.set(response.access_token);

        // 2. Store Refresh Token locally
        localStorage.setItem('refresh_token', response.refresh_token);
        
        // 3. Fetch user info
        this.fetchCurrentUser();
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

    return this.http.get<AuthResponse>('/auth/refresh', { headers }).pipe(
      tap((response) => {
        console.log('Session restored!');
        
        this.token.set(response.access_token);

        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }
        
        // Fetch user info after session refresh
        this.fetchCurrentUser();
      }),
      catchError((err) => {
        console.log('Refresh failed', err);
        this.logout(); 
        return of(null);
      })
    );
  }

  fetchCurrentUser(): void {
    const query = `
      query Whoami {
        me {
          email
          fullName
          userType
        }
      }
    `;

    const refresh_token = localStorage.getItem('refresh_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${refresh_token || ''}`);

    this.http.post<any>('/graphQL', { query }, { headers }).subscribe({
      next: (response) => {
        if (response?.data?.me) {
          this.currentUser.set(response.data.me);
        }
      },
      error: (err) => {
        console.error('Failed to fetch current user', err);
      }
    });
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  logout() {
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('refresh_token');
  }
}