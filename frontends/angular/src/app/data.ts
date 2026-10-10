import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, RESPONSE_INIT } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of, throwError } from 'rxjs';
import type { Post } from './post';

/*
 * Page data is read with HttpClient from same-origin `/data/...` URLs (a read-only mirror of the API's GET routes).
 *
 * - During SSR the request never leaves the process for the frontend itself: app.config.server.ts swaps the
 *   HttpClient backend for one that sends `/data/<path>` straight to `BACKEND_URL/<path>`, so BACKEND_URL exists
 *   only in the server bundle. The default HttpClient transfer cache (provideClientHydration) stores the response
 *   under the relative URL and serializes it into the page (`<script id="ng-state">`).
 * - In the browser the first navigation reads that cache instead of making a request. Later reads (client-side
 *   navigation, the refresh after a like) go to `/data/...` on this server (server.ts), never to the API.
 */

export const feedResolver: ResolveFn<Post[]> = () =>
  inject(HttpClient)
    .get<{ posts: Post[] }>('/data/feed')
    .pipe(map((r) => r.posts));

/** A missing post (API 404) or an invalid id (API 400) resolves to null and sets a real 404 status during SSR. */
export const postResolver: ResolveFn<Post | null> = (route) => {
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const id = route.paramMap.get('id') ?? '';
  return inject(HttpClient)
    .get<{ post: Post }>(`/data/posts/${encodeURIComponent(id)}`)
    .pipe(
      map((r) => r.post),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400)) {
          if (responseInit) responseInit.status = 404;
          return of(null);
        }
        return throwError(() => err);
      }),
    );
};
