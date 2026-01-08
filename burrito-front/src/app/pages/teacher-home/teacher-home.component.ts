import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router'; // Added Router
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';

interface TeacherEvaluation {
  id: number;
  courseName: string;
  submittedDate: Date;
  rating: number; // 1-5
  isRead: boolean;
}

@Component({
  selector: 'app-teacher-home',
  standalone: true,
  imports: [
    CommonModule, 
    DatePipe,
    BackgroundDivComponent, 
    AdminPageHeaderComponent
  ],
  templateUrl: './teacher-home.component.html',
  styleUrls: ['./teacher-home.component.scss']
})
export class TeacherHomeComponent {

  // 1. New / Unread Items
  unreadEvaluations: TeacherEvaluation[] = [
    { 
      id: 101, 
      courseName: 'Intro to AI (CS-101)', 
      submittedDate: new Date('2023-12-19'), 
      rating: 5,
      isRead: false
    },
    { 
      id: 102, 
      courseName: 'Intro to AI (CS-101)', 
      submittedDate: new Date('2023-12-18'), 
      rating: 4,
      isRead: false
    },
    { 
      id: 103, 
      courseName: 'Advanced Algorithms', 
      submittedDate: new Date('2023-12-18'), 
      rating: 2,
      isRead: false
    }
  ];

  // 2. Archive / Read Items
  readEvaluations: TeacherEvaluation[] = [
    { 
      id: 88, 
      courseName: 'Intro to AI (CS-101)', 
      submittedDate: new Date('2023-11-10'), 
      rating: 5,
      isRead: true
    },
    { 
      id: 85, 
      courseName: 'Advanced Algorithms', 
      submittedDate: new Date('2023-11-05'), 
      rating: 3,
      isRead: true
    }
  ];

  constructor(private router: Router) {}

  viewEvaluation(id: number) {
    console.log(`Viewing evaluation detail #${id}`);
    // In a real app, clicking this would likely mark it as read 
    // and navigate to the details page.
    // this.router.navigate(['/teacher/evaluation', id]);
  }
}