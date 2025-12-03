import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../component/shared/button/button.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, BackgroundDivComponent, ButtonComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';

  onSubmit() {
    // TODO: plug your registration logic here
    console.log('Register with', {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
    });
  }
}
