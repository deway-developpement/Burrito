import { Routes } from '@angular/router';
import { SignInComponent } from './pages/sign-in/sign-in.component';
import { RegisterComponent } from './pages/register/register.component';
import { PrivacyPolicyComponent } from './pages/privacy/privacy-policy.component';
import { TermsOfServiceComponent } from './pages/terms/terms-of-service.component';
import { LegalMentionsComponent } from './pages/legal/legal-mentions.component';
import { CookiePolicyComponent } from './pages/cookie/cookie-policy.component';
import { ContactComponent } from './pages/contact/contact.component';
import { ManageTeachersComponent } from './pages/manage/teacher/manage-teachers.component';
import { ManageStudentsComponent } from './pages/manage/student/manage-students.component';
import { HomeComponent } from './pages/home/home.component';

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
];
