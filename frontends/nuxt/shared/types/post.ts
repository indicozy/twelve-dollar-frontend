export type Post = {
  id: number
  body: string
  created_at: string
  author: string
  like_count: number
}

/** What the form endpoints in server/routes/ answer to an enhanced (fetch) submit. */
export type ActionResult = { redirect?: string; error?: string | null }
