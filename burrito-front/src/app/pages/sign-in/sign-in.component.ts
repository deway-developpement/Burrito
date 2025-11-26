import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../component/shared/button/button.component';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, BackgroundDivComponent, ButtonComponent],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss'],
})
export class SignInComponent {
  email = '';
  password = '';

  onSubmit() {
    // TODO: plug your auth logic here
    console.log('Sign in with', this.email, this.password);
  }
}
