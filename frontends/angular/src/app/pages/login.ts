import { Component } from '@angular/core';

/** Posts to its own URL; `POST /login` in server.ts signs the demo token and sets the cookie. */
@Component({
  selector: 'app-login',
  host: { style: 'display: contents' },
  template: `
    <form method="post" class="login">
      <h1>Sign in</h1>
      <p class="muted">The API has no login endpoint; this signs a demo HS256 token (like the challenge's seed tokens).</p>
      <label>User id <input name="user_id" type="number" min="1" value="1" required /></label>
      <label>Username <input name="username" value="golden_ember_1" required /></label>
      <button type="submit">Continue</button>
    </form>
  `,
})
export class LoginPage {}
