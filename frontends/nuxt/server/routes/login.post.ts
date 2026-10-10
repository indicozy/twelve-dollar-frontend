// POST /login: the login page's form posts to its own URL (GET /login is still rendered by the Vue app).
import { signToken, TOKEN_COOKIE } from '../utils/session'
import { assertSameOrigin } from '../utils/forms'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const form = await readFormData(event)
  const id = Number(form.get('user_id'))
  const username = String(form.get('username') ?? '').trim()
  if (!Number.isInteger(id) || id < 1 || !username) return sendRedirect(event, '/login?error=1', 303)
  setCookie(event, TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: 'lax', path: '/' })
  return sendRedirect(event, '/', 303)
})
