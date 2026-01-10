import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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
  if (user.userType === 'admin') {
    return true;
  }

  // Teacher can only view their own results
  if (user.userType === 'teacher' && user.id === teacherId) {
    return true;
  }

  // Deny access
  router.navigate(['/']);
  return false;
};
