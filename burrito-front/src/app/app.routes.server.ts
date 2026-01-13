import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // TODO: Revisit prerendering for parameterized routes once getPrerenderParams is defined.
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
