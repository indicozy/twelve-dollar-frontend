// The compose form on the feed page.
import { createPost } from '../../utils/api'
import { assertSameOrigin, respond } from '../../utils/forms'
import { TOKEN_COOKIE } from '../../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const token = getCookie(event, TOKEN_COOKIE)
  if (!token) return respond(event, '/login')
  const form = await readFormData(event)
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get('body') ?? ''))
  if (status !== 201) {
    const error = data.error ?? `error ${status}`
    return respond(event, `/?error=${encodeURIComponent(error)}`, { error })
  }
  return respond(event, '/', { error: null })
})
