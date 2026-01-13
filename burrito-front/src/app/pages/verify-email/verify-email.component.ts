import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    <section class="verify">
      <h1 i18n="@@verifyEmail.title">Email verification</h1>

      <div *ngIf="status() === \'loading\'" i18n="@@verifyEmail.loading">Verifying your email...</div>
      <div *ngIf="status() === \'success\'" class="success">
        <span i18n="@@verifyEmail.success">Your email has been verified successfully!</span>
        <p i18n="@@verifyEmail.redirect">Redirecting to home in a moment...</p>
      </div>
      <div *ngIf="status() === \'error\'" class="error">
        <span i18n="@@verifyEmail.failed">Verification failed: {{ errorMessage() || invalidTokenMessage }}</span>
        <a routerLink="/sign-in" i18n="@@verifyEmail.signIn">Sign in</a>
      </div>
    </section>
  `,
  styles: [
    `
    .verify { padding: 2rem; }
    .success { color: #2e7d32; margin-top: 1rem; }
    .error { color: #c62828; margin-top: 1rem; }
    a { margin-left: 0.5rem; }
    `
  ]
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apollo = inject(Apollo);
  private userService = inject(UserService);

  status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  errorMessage = signal<string | null>(null);
  invalidTokenMessage = $localize`:@@verifyEmail.invalidToken:Invalid or expired token.`;
  missingTokenMessage = $localize`:@@verifyEmail.missingToken:Missing token.`;
  private hasAttempted = false;

  async ngOnInit() {
    // Prevent re-running verification on reinit
    if (this.hasAttempted) {
      return;
    }
    this.hasAttempted = true;
    
    this.status.set('loading');
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status.set('error');
      this.errorMessage.set(this.missingTokenMessage);
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
      if (updatedUser) {
        // Update front-end user state so banner disappears
        this.userService.currentUser.set({
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified,
          userType: updatedUser.userType,
        });
        this.status.set('success');
        
        // Auto-redirect immediately (no wait)
        this.router.navigate(['/']);
      } else {
        this.status.set('error');
      }
    } catch (err: any) {
      const message = (err?.message as string) || null;
      this.errorMessage.set(message);
      this.status.set('error');
    }
  }
}

