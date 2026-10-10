import { RenderMode, ServerRoute } from '@angular/ssr';

// Every route is rendered on the server on every request: no prerendering, no client-only routes, no caching.
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'posts/:id', renderMode: RenderMode.Server }, // 404 for missing/invalid ids: postResolver sets RESPONSE_INIT
  { path: 'login', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
