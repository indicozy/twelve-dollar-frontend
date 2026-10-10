// Read endpoint behind useFetch('/api/posts/:id') on the post page.
import { getPost } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const post = await getPost(getRouterParam(event, 'id', { decode: true }) ?? '')
  if (!post) throw createError({ status: 404, statusText: 'Not found' })
  return post
})
