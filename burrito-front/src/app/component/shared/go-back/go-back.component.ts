import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-go-back',
  standalone: true,
  imports: [],
  templateUrl: './go-back.component.html',
  styleUrl: './go-back.component.scss'
})
export class GoBackComponent {
  private location = inject(Location);

  goBack() {
    this.location.back();
  }
}
