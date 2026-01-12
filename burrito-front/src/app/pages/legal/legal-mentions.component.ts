import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';

@Component({
  selector: 'app-legal-mentions',
  standalone: true, 
  imports: [RouterLink, GoBackComponent], 
  templateUrl: './legal-mentions.component.html',
  styleUrls: ['./legal-mentions.component.scss']
})
export class LegalMentionsComponent {
}