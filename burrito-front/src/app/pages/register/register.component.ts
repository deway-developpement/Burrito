import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; // Often needed for AsyncPipe or ngIf
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../component/shared/button/button.component';
import { ToastService } from '../../services/toast.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, BackgroundDivComponent, ButtonComponent, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private router = inject(Router);
  private userService = inject(UserService);
  private toast = inject(ToastService);

  firstName = '';
  lastName = '';
  email = '';
  password = '';

  isLoading = false;

  onSubmit() {
    if (!this.email || !this.password || !this.firstName || !this.lastName) {
      this.toast.show('Please fill in all fields', 'error');
      return;
    }

    this.isLoading = true;

    const payload = {
      fullName: `${this.firstName} ${this.lastName}`.trim(),
      email: this.email,
      password: this.password
    };

    this.userService.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        console.log('Registered:', res);
        this.toast.show('Account created! Please sign in.', 'success');
        this.router.navigate(['/sign-in']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Registration full error:', err);

        // --- ERROR HANDLING FIX ---
        // 1. Check if it's a GraphQL logic error (e.g. Email exists)
        if (err.graphQLErrors && err.graphQLErrors.length > 0) {
          const message = err.graphQLErrors[0].message;
          this.toast.show(message, 'error'); 
        } 
        // 2. Check if it's a network/server error
        else if (err.networkError) {
          this.toast.show('Network error. Is the server running?', 'error');
        } 
        // 3. Fallback
        else {
          this.toast.show('Registration failed. Please try again.', 'error');
        }
      }
    });
  }
}