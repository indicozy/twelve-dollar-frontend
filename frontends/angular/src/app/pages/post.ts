import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Post } from '../post';
import { PostCard } from '../post-card';
import { NotFoundPage } from './not-found';

@Component({
  selector: 'app-post',
  imports: [RouterLink, PostCard, NotFoundPage],
  host: { style: 'display: contents' },
  template: `
    @if (post(); as post) {
      <a routerLink="/" class="back">← back to feed</a>
      <article class="post" [post]="post" [link]="false"></article>
    } @else {
      <!-- postResolver set the 404 status (RESPONSE_INIT) during SSR -->
      <app-not-found />
    }
  `,
})
export class PostPage {
  /** From postResolver: null when the API answered 404 (missing) or 400 (invalid id). */
  readonly post = input.required<Post | null>();
}
