import { Component } from '@angular/core';
import { ButtonComponent } from '../../component/shared/button/button.component'; // adapte le chemin
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

@Component({
  selector: 'app-home-default',
  standalone: true,
  imports: [ButtonComponent, BackgroundDivComponent],
  templateUrl: './home-default.component.html',
  styleUrls: ['./home-default.component.scss'],
})
export class HomeDefaultComponent {
}
