import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Unknown paths (status 404 via app.routes.server.ts) and missing posts (404 via RESPONSE_INIT). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  host: { style: 'display: contents' },
  template: `
    <div class="empty">
      <h1>Not found</h1>
      <a routerLink="/">← back to feed</a>
    </div>
  `,
})
export class NotFoundPage {}
