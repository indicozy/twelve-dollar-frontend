import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormAction } from './form-action';
import { formatDate, type Post } from './post';

/**
 * Selector `article.post` so the component's host element *is* the reference markup's
 * `<article class="post" data-post-id="…">` (no wrapper element, no extra attribute).
 */
@Component({
  selector: 'article.post',
  imports: [RouterLink],
  host: { '[attr.data-post-id]': 'post().id' },
  template: `
    <header>
      <span class="author">&#64;{{ post().author }}</span>
      <time [attr.datetime]="post().created_at">{{ date() }}</time>
    </header>
    <p>{{ post().body }}</p>
    <footer>
      <form method="post" action="/actions/like" (submit)="like($event)">
        <input type="hidden" name="id" [attr.value]="post().id" />
        <button type="submit" class="like">♥ <span>{{ post().like_count }}</span></button>
      </form>
      @if (link()) {
        <a [routerLink]="'/posts/' + post().id">#{{ post().id }}</a>
      } @else {
        <span class="muted">#{{ post().id }}</span>
      }
    </footer>
  `,
})
export class PostCard {
  readonly post = input.required<Post>();
  readonly link = input(true);
  protected readonly date = computed(() => formatDate(this.post().created_at));
  private readonly action = inject(FormAction);

  protected like(event: Event) {
    void this.action.submit(event);
  }
}
