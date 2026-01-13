import { Component, OnInit, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../services/user.service';

const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      id
      fullName
      email
      emailVerified
      userType
    }
  }
`;

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div *ngIf="status() === 'loading'" class="verify-loading">
      <div class="loading-spinner"></div>
      <p>Verifying your email…</p>
    </div>
    <div *ngIf="status() === 'success'" class="verify-success">
      <div class="success-icon">✓</div>
      <h1>Email verified!</h1>
      <p>Redirecting you now…</p>
    </div>
  `,
  styles: [
    `
      .verify-loading,
      .verify-success {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 60px);
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(63, 81, 181, 0.2);
        border-top: 4px solid #3f51b5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      .success-icon {
        font-size: 3rem;
        color: #2e7d32;
        margin-bottom: 1rem;
        animation: popIn 0.4s ease-out;
      }

      .verify-success h1 {
        color: #333;
        font-size: 1.8rem;
        margin: 0 0 0.5rem 0;
      }

      .verify-success p {
        color: #666;
        font-size: 1rem;
        margin: 0;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes popIn {
        from {
          transform: scale(0);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      .verify-loading p {
        color: #333;
        font-size: 1rem;
      }
    `
  ]
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apollo = inject(Apollo);
  private readonly userService = inject(UserService);
  private readonly platformId = inject(PLATFORM_ID);

  status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  private hasAttempted = false;

  async ngOnInit() {
    // Only run on browser, not on server
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Prevent re-running verification on reinit
    if (this.hasAttempted) {
      return;
    }
    this.hasAttempted = true;
    
    this.status.set('loading');
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.router.navigate(['/404']);
      return;
    }

    try {
      const response = await firstValueFrom(
        this.apollo.mutate<{ verifyEmail: any }>({
          mutation: VERIFY_EMAIL_MUTATION,
          variables: { input: { token } },
          fetchPolicy: 'no-cache'
        })
      );

      const updatedUser = response.data?.verifyEmail;

      if (updatedUser?.emailVerified) {
        // Update front-end user state so banner disappears
        this.userService.currentUser.set({
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified,
          userType: updatedUser.userType,
        });
        this.status.set('success');
        
        // Auto-redirect after a short delay
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1500);
      } else {
        this.router.navigate(['/404']);
      }
    } catch (err: any) {
      console.error('Email verification failed:', err);
      this.router.navigate(['/404']);
    }
  }
}
