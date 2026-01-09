import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Import your page components
import { StudentHomeComponent } from '../student-home/student-home.component';
import { TeacherHomeComponent } from '../teacher-home/teacher-home.component';
import { AdminHomeComponent } from '../admin-home/admin-home.component';
import { HomeDefaultComponent } from '../home-default/home-default.component';

// Import Service
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-home',
  standalone: true,
  // We import CommonModule for ngSwitch, and all the possible child components
  imports: [
    CommonModule, 
    StudentHomeComponent, 
    TeacherHomeComponent, 
    AdminHomeComponent, 
    HomeDefaultComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  private userService = inject(UserService);

  // INCORRECT: returns the Signal object
  // get user() { return this.userService.currentUser; } 

  // CORRECT: returns the value inside the Signal
  get user() { 
    return this.userService.currentUser(); 
  }
}