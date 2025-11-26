import { Component } from '@angular/core';
import { ButtonComponent } from '../../component/shared/button/button.component'; // adapte le chemin
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ButtonComponent, BackgroundDivComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
}
