import { Routes } from '@angular/router';
import { SignInComponent } from './pages/sign-in/sign-in.component';
import { RegisterComponent } from './pages/register/register.component';
import { FeedbackStudentComponent } from './pages/feedback/student/feedback-student.component';
import { FeedbackAdminComponent } from './pages/feedback/admin/feedback-admin.component';
import { PrivacyPolicyComponent } from './pages/privacy/privacy-policy.component';
import { TermsOfServiceComponent } from './pages/terms/terms-of-service.component';
import { LegalMentionsComponent } from './pages/legal/legal-mentions.component';
import { CookiePolicyComponent } from './pages/cookie/cookie-policy.component';
import { ContactComponent } from './pages/contact/contact.component';
import { ManageTeachersComponent } from './pages/manage/teacher/manage-teachers.component';
import { ManageStudentsComponent } from './pages/manage/student/manage-students.component';
import { HomeComponent } from './pages/home/home.component';
import { ResultsComponent } from './pages/results/results.component';
import { ResultsTeacherComponent } from './pages/results-teacher/results-teacher.component';
import { ResultsFormComponent } from './pages/results-form/results-form.component';
import { GlobalReportsComponent } from './pages/global-reports/global-reports.component';
import { authGuard } from './guards/auth.guard';
import { teacherAccessGuard } from './guards/teacher-access.guard';

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
    path: 'legal/privacy',
    component: PrivacyPolicyComponent
  },
  {
    path: 'legal/terms',
    component: TermsOfServiceComponent
  },
  {
    path: 'legal/mentions',
    component: LegalMentionsComponent
  },
  {
    path: 'legal/cookies',
    component: CookiePolicyComponent
  },
  {
    path: 'contact',
    component: ContactComponent
  },
  {
    path: 'admin/manage/teachers',
    component: ManageTeachersComponent
  },
  {
    path: 'admin/manage/students',
    component: ManageStudentsComponent
  },
  {
    path: 'admin/reports',
    component: GlobalReportsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'results/:id',
    component: ResultsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'results/teacher/:teacherId',
    component: ResultsTeacherComponent,
    // canActivate: [authGuard, teacherAccessGuard]
    //TODO: Temporarily disabled guards for testing
  },
  {
    path: 'results/form/:formId',
    component: ResultsFormComponent,
    canActivate: [authGuard]
  }
  {
    path: 'feedback/student',
    component: FeedbackStudentComponent
  },
  {
    path: 'feedback/admin',
    component: FeedbackAdminComponent
  }
];
