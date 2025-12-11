import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../component/shared/button/button.component';
import { ToastService } from '../../services/toast.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, BackgroundDivComponent, ButtonComponent, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  // Dependencies
  private router = inject(Router);
  private userService = inject(UserService);
  private toast = inject(ToastService);

  // Form Data
  firstName = '';
  lastName = '';
  email = '';
  password = '';

  // UI State
  isLoading = false;

  onSubmit() {
    // 1. Basic Validation
    if (!this.email || !this.password || !this.firstName || !this.lastName) {
      this.toast.show('Please fill in all fields', 'error');
      return;
    }

    this.isLoading = true;

    // 2. Prepare payload (Combine names for the API)
    const payload = {
      fullName: `${this.firstName} ${this.lastName}`.trim(),
      email: this.email,
      password: this.password
    };

    // 3. Call Service
    this.userService.register(payload).subscribe({
      next: () => {
        // Success Logic
        this.toast.show('Account created! Please sign in.', 'success');
        this.router.navigate(['/sign-in']);
      },
      error: (err) => {
        // Error Logic
        console.error('Registration error:', err);
        this.isLoading = false;
        
        // Optional: Check for specific backend errors (like duplicate email)
        this.toast.show('Registration failed. Please try again.', 'error');
      }
    });
  }
}