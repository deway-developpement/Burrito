import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SignInComponent } from './pages/sign-in/sign-in.component';
import { RegisterComponent } from './pages/register/register.component';
import { FeedbackStudentComponent } from './pages/feedback/student/feedback-student.component';
import { FeedbackAdminComponent } from './pages/feedback/admin/feedback-admin.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'sign-in',
    component: SignInComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'feedback/student',
    component: FeedbackStudentComponent
  },
  {
    path: 'feedback/admin',
    component: FeedbackAdminComponent
  }
];
