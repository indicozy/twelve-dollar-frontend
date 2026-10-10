import { likePost } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  const { status, data } = await likePost(getRequestHeader(event, 'authorization'), id)
  setResponseStatus(event, status)
  return data
})
