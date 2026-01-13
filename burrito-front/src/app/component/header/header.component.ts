import { Component, inject, signal } from '@angular/core';
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

  // UI state for resend action
  isResending = signal(false);
  resendStatus = signal<'idle' | 'success' | 'error'>('idle');
  bannerDismissed = signal(false);
  showSuccessModal = signal(false);

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
}