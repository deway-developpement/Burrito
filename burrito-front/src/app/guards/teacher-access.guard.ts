import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

export const teacherAccessGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const teacherId = route.params['teacherId'];
  const user = authService.getCurrentUser();

  if (!user) {
    router.navigate(['/sign-in']);
    return false;
  }

  // Admin can view any teacher
  if (user.userType === 'ADMIN') {
    return true;
  }

  // Teacher can only view their own results
  if (user.userType === 'TEACHER' && user.id === teacherId) {
    return true;
  }

  // Deny access
  router.navigate(['/']);
  return false;
};
