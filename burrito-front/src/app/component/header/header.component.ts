import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  userService = inject(UserService);
  authService = inject(AuthService);

  // UI state for resend action
  isResending = signal(false);
  resendStatus = signal<'idle' | 'success' | 'error'>('idle');

  logout() {
    // Calling the cleanup method we saw in your service earlier
    // allows the UI to update immediately for testing
    this.userService.clearUserData();
    this.authService.logout();
    console.log('Logout clicked');
  }

  resendVerification() {
    this.isResending.set(true);
    this.resendStatus.set('idle');
    this.userService.resendEmailVerification().subscribe({
      next: () => {
        this.resendStatus.set('success');
        this.isResending.set(false);
      },
      error: () => {
        this.resendStatus.set('error');
        this.isResending.set(false);
      },
    });
  }
}