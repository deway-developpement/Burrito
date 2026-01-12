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

  console.log('[teacherAccessGuard] teacherId from route:', teacherId);
  console.log('[teacherAccessGuard] current user:', user);

  if (!user) {
    router.navigate(['/sign-in']);
    return false;
  }

  // Admin can view any teacher
  if (user.userType === 'ADMIN') {
    console.log('[teacherAccessGuard] Admin access granted');
    return true;
  }

  // Teacher can only view their own results
  if (user.userType === 'TEACHER' && user.id === teacherId) {
    console.log('[teacherAccessGuard] Teacher viewing own results - access granted');
    return true;
  }

  // Deny access
  console.log('[teacherAccessGuard] Access denied - redirecting to home');
  router.navigate(['/']);
  return false;
};
