import { Component } from '@angular/core';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [GoBackComponent],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
}