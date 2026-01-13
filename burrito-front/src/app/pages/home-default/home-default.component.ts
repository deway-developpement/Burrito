import { Component, inject } from '@angular/core';
import { Router } from '@angular/router'; // 1. Import Router
import { ButtonComponent } from '../../component/shared/button/button.component';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

@Component({
  selector: 'app-home-default',
  standalone: true,
  imports: [ButtonComponent, BackgroundDivComponent],
  templateUrl: './home-default.component.html',
  styleUrls: ['./home-default.component.scss'],
})
export class HomeDefaultComponent {
  // 2. Inject the Router
  private readonly router = inject(Router);

  // 3. Create the redirect method
  onGetStarted() {
    this.router.navigate(['/sign-in']);
  }
}