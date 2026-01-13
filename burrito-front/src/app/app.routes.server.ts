import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'results/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'results/teacher/:teacherId',
    renderMode: RenderMode.Server
  },
  {
    path: 'results/form/:formId',
    renderMode: RenderMode.Server
  },
  {
    path: 'student/evaluate/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'verify-email',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
