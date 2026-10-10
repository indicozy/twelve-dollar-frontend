import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Session } from './session';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  host: { style: 'display: contents' },
  template: `
    <header class="top">
      <a routerLink="/" class="brand">feed<span>.</span></a>
      <span class="stack">angular</span>
      <nav>
        @if (username; as name) {
          <span class="who">&#64;{{ name }}</span>
        } @else {
          <a routerLink="/login">Sign in</a>
        }
      </nav>
    </header>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected readonly username = inject(Session).username;
}
