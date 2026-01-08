import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';

interface Evaluation {
  id: number;
  teacherName: string;
  courseName: string;
  deadline?: Date;     // Only for pending
  submittedDate?: Date; // Only for completed
  status: 'Pending' | 'Completed';
}

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    DatePipe,
    BackgroundDivComponent, 
    AdminPageHeaderComponent
  ],
  templateUrl: './student-home.component.html',
  styleUrls: ['./student-home.component.scss']
})
export class StudentHomeComponent {

  // 1. Actionable Items
  pendingEvaluations: Evaluation[] = [
    { 
      id: 1, 
      teacherName: 'Dr. Sarah Connor', 
      courseName: 'Intro to AI (CS-101)', 
      deadline: new Date('2023-12-15'), 
      status: 'Pending' 
    },
    { 
      id: 2, 
      teacherName: 'Prof. Indiana Jones', 
      courseName: 'Ancient History (HIS-202)', 
      deadline: new Date('2023-12-20'), 
      status: 'Pending' 
    }
  ];

  // 2. Read-only History
  completedEvaluations: Evaluation[] = [
    { 
      id: 3, 
      teacherName: 'Dr. Emmett Brown', 
      courseName: 'Physics 101', 
      submittedDate: new Date('2023-11-05'), 
      status: 'Completed' 
    },
    { 
      id: 4, 
      teacherName: 'Mrs. Ellen Ripley', 
      courseName: 'Flight Safety', 
      submittedDate: new Date('2023-10-20'), 
      status: 'Completed' 
    }
  ];

  constructor() {}

  // This would redirect to the actual form
  startEvaluation(id: number) {
    console.log(`Navigating to form for evaluation #${id}`);
    // this.router.navigate(['/student/evaluate', id]);
  }
}