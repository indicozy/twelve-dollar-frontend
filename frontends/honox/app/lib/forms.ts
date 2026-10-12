// Shared by the HTML form routes (plain form posts, Post/Redirect/Get), which sit behind Hono's built-in CSRF
// middleware: a form-encoded POST passes only if Sec-Fetch-Site is "same-origin" or Origin equals the request URL's
// origin, else 403. The JSON routes under /api are not checked.
import { csrf } from 'hono/csrf';

export const form = csrf();

/** Same-origin path of the page the form was posted from, else /. */
export function backTo(referer: string | undefined, host: string | undefined): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(referer ?? '');
  if (referer && m && m[1].toLowerCase() === (host ?? '').toLowerCase()) {
    const path = referer.slice(referer.indexOf('//') + 2 + m[1].length).split(/[?#]/)[0];
    return path.startsWith('/') ? path : '/';
  }
  return '/';
}

/** JSON route responses: the API's status and body bytes unchanged. */
export const passthrough = async (r: Response) =>
  new Response(await r.arrayBuffer(), {
    status: r.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
