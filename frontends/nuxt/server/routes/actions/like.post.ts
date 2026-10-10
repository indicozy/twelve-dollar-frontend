// The like form on every post card (feed and post page).
import { likePost } from '../../utils/api'
import { assertSameOrigin, backTo, respond } from '../../utils/forms'
import { TOKEN_COOKIE } from '../../utils/session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const token = getCookie(event, TOKEN_COOKIE)
  if (!token) return respond(event, '/login')
  const form = await readFormData(event)
  await likePost(`Bearer ${token}`, String(form.get('id')))
  return respond(event, backTo(event))
})
