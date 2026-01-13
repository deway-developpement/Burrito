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
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private userService = inject(UserService);

  // Form Data
  email = '';
  password = '';

  // UI State
  isLoading = false;
  errorMessage = '';

  onSubmit() {
    // Basic validation
    if (!this.email || !this.password) {
      this.errorMessage =
        $localize`:@@signIn.missingFields:Please fill in all fields.`;
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
        
        this.toast.show(
          $localize`:@@signIn.successToast:Welcome back! Login successful.`,
          'success',
        );
        
        // ✅ Le redirect se fait maintenant avec les données utilisateur en poche
        this.router.navigate(['/']); 
      },
      error: (err) => {
        // Si le Login échoue OU si le FetchMe plante (sauf si fetchMe catch l'erreur)
        console.error('Login flow error:', err);
        this.isLoading = false;
        
        if (err.status === 401) {
          this.errorMessage =
            $localize`:@@signIn.invalidCredentials:Invalid email or password.`;
          this.toast.show(
            $localize`:@@signIn.failedToast:Login failed. Please check your credentials.`,
            'error',
          );
        } else {
          this.errorMessage =
            $localize`:@@signIn.unexpectedError:An unexpected error occurred.`;
          this.toast.show(
            $localize`:@@signIn.unknownError:An unknown error has occurred`,
            'error',
          );
        }
      }
    });
  }
}
