import type { H3Event } from 'h3'
import type { ActionResult } from '#shared/types/post'

/**
 * Nuxt/Nitro has no CSRF or origin check of its own. The form endpoints apply the same rule as Next.js server
 * actions: a request carrying an Origin header must come from the host it was sent to. Works over plain http on
 * any host (localhost:3000, 127.0.0.1:3000, the sim's IP), with no build-time origin. The JSON routes under
 * /api are not checked, like in the other variants.
 */
export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')
  if (!origin) return
  let host: string | null = null
  try {
    host = new URL(origin).host
  } catch {}
  if (host !== getRequestHeader(event, 'host')) {
    throw createError({ status: 403, statusText: 'Cross-site form submission' })
  }
}

/** Enhanced submits (fetch from the page's JS) ask for JSON; plain HTML form posts get a 303 redirect. */
const wantsJson = (event: H3Event) => (getRequestHeader(event, 'accept') ?? '').includes('application/json')

/** Answer a form submit: JSON for enhanced submits, otherwise redirect (post/redirect/get). */
export function respond(event: H3Event, to: string, result: ActionResult = {}) {
  if (wantsJson(event)) {
    if (to === '/login') return { redirect: to } satisfies ActionResult
    return result
  }
  return sendRedirect(event, to, 303)
}

/** Same-origin path of the page the form was posted from (plain form posts), else `/`. */
export function backTo(event: H3Event): string {
  const referer = getRequestHeader(event, 'referer')
  if (!referer) return '/'
  try {
    const url = new URL(referer)
    return url.host === getRequestHeader(event, 'host') ? url.pathname : '/'
  } catch {
    return '/'
  }
}
