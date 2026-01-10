import { Component, inject } from '@angular/core';
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

  logout() {
    // Calling the cleanup method we saw in your service earlier
    // allows the UI to update immediately for testing
    this.userService.clearUserData();
    this.authService.logout();
    console.log('Logout clicked');
  }
}