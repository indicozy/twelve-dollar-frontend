import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { ActionResult } from './post';

/**
 * Progressive enhancement for the like/compose forms (the counterpart of SvelteKit's `use:enhance`, Nuxt's
 * useFormAction and Next.js form actions). Without JS the form posts normally and server.ts answers with a 303
 * redirect; with JS the same form is posted with fetch (Accept: application/json) and the current route's
 * resolvers run again to show fresh data.
 */
@Injectable({ providedIn: 'root' })
export class FormAction {
  private readonly router = inject(Router);

  async submit(event: Event, pending = signal(false)): Promise<ActionResult> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    pending.set(true);
    try {
      const res = await fetch(form.getAttribute('action')!, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>),
        headers: { accept: 'application/json' },
      });
      const result = (await res.json()) as ActionResult;
      if (result.redirect) {
        await this.router.navigateByUrl(result.redirect);
      } else if (!result.error) {
        await this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
      }
      return result;
    } finally {
      pending.set(false);
    }
  }
}
