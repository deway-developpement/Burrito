import { Component } from '@angular/core';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [GoBackComponent],
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.scss']
})
export class TermsOfServiceComponent {
}