import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../component/shared/button/button.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { switchMap } from 'rxjs'; // Important
import { UserService } from './../../services/user.service'; // Ton nouveau service

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, BackgroundDivComponent, ButtonComponent],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss'],
})
export class SignInComponent {
  // Dependencies
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly userService = inject(UserService);

  // Form Data
  email = '';
  password = '';

  // UI State
  isLoading = false;
  errorMessage = '';

  onSubmit() {
    // Basic validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = { 
      email: this.email, 
      password: this.password 
    };

    // On commence la chaîne ici
    this.authService.login(credentials).pipe(
      // ✅ Une fois le login réussi, on déclenche immédiatement le fetchMe
      switchMap(() => this.userService.fetchMe()) 
    ).subscribe({
      next: (userProfile) => {
        // On arrive ici SEULEMENT quand le login ET le fetchMe sont finis
        console.log('Login & User data fetched successfully', userProfile);
        
        this.toast.show('Welcome back! Login successful.', 'success');
        
        // ✅ Le redirect se fait maintenant avec les données utilisateur en poche
        this.router.navigate(['/']); 
      },
      error: (err) => {
        // Si le Login échoue OU si le FetchMe plante (sauf si fetchMe catch l'erreur)
        console.error('Login flow error:', err);
        this.isLoading = false;
        
        if (err.status === 401) {
          this.errorMessage = 'Invalid email or password.';
          this.toast.show('Login failed. Please check your credentials.', 'error');
        } else {
          this.errorMessage = 'An unexpected error occurred.';
          this.toast.show('An unknown error has occurred', 'error');
        }
      }
    });
  }
}