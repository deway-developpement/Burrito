import { Component } from '@angular/core';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';

@Component({
  selector: 'app-background-div',
  standalone: true,
  imports: [HeaderComponent, FooterComponent],
  templateUrl: './background-div.component.html',
  styleUrls: ['./background-div.component.scss'],
})
export class BackgroundDivComponent {}
