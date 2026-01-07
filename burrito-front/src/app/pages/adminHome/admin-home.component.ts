import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';   
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, BackgroundDivComponent], // DatePipe imported for formatting date in HTML
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.scss']
})
export class AdminHomeComponent {
  
  today: Date = new Date();

  // You can later inject a DashboardService here to fetch real numbers
  // for the stats cards.

  constructor() {}
}