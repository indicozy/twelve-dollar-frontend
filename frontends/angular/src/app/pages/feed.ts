import { Component, inject, input, signal } from '@angular/core';
import { FormAction } from '../form-action';
import type { Post } from '../post';
import { PostCard } from '../post-card';

@Component({
  selector: 'app-feed',
  imports: [PostCard],
  host: { style: 'display: contents' },
  template: `
    <form method="post" action="/actions/create" class="compose" (submit)="create($event)">
      <textarea name="body" maxlength="500" placeholder="What's happening on the $12 server?" required rows="3"></textarea>
      <div>
        @if (error() ?? errorParam()) {
          <span class="error">{{ error() ?? errorParam() }}</span>
        } @else {
          <span class="muted">max 500 chars</span>
        }
        <button type="submit" [disabled]="pending()">{{ pending() ? 'Posting…' : 'Post' }}</button>
      </div>
    </form>
    <h1>Latest</h1>
    <section class="feed">
      @for (p of posts(); track p.id) {
        <article class="post" [post]="p"></article>
      }
    </section>
  `,
})
export class FeedPage {
  /** From feedResolver (withComponentInputBinding). */
  readonly posts = input.required<Post[]>();
  /** `/?error=…`: a plain (no-JS) compose submit that the API rejected. */
  readonly errorParam = input<string | undefined>(undefined, { alias: 'error' });
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);
  private readonly action = inject(FormAction);

  protected async create(event: Event) {
    const form = event.target as HTMLFormElement;
    const result = await this.action.submit(event, this.pending);
    this.error.set(result.error ?? null);
    if (!result.error && !result.redirect) form.reset();
  }
}
