// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import { createPost } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const authorization = getRequestHeader(event, 'authorization')
  let body = ''
  try {
    // readBody() parses leniently (destr), so parse the raw body strictly like Request.json() does.
    body = String(JSON.parse((await readRawBody(event, 'utf8')) ?? '').body ?? '')
  } catch {
    setResponseStatus(event, 400)
    return { error: 'malformed JSON body' }
  }
  const { status, data } = await createPost(authorization, body)
  setResponseStatus(event, status)
  return data
})
