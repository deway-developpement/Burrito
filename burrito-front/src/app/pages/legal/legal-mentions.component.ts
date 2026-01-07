import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router'; 

@Component({
  selector: 'app-legal-mentions',
  standalone: true, 
  imports: [RouterLink], 
  templateUrl: './legal-mentions.component.html',
  styleUrls: ['./legal-mentions.component.scss']
})
export class LegalMentionsComponent {
  
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}