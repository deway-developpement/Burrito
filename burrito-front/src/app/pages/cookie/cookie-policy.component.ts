import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-policy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-policy.component.html',
  styleUrls: ['./cookie-policy.component.scss']
})
export class CookiePolicyComponent {
  
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}