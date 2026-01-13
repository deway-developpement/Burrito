import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';

@Component({
  selector: 'app-cookie-policy',
  standalone: true,
  imports: [RouterLink, GoBackComponent],
  templateUrl: './cookie-policy.component.html',
  styleUrls: ['./cookie-policy.component.scss']
})
export class CookiePolicyComponent {
}