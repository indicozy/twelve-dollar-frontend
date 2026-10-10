// Server-only: read the signed-in name from the `token` cookie on every request (it is httpOnly, so the browser
// can't read it; the value reaches the client through the payload).
export default defineNuxtPlugin(() => {
  const token = useCookie('token', { readonly: true }).value
  let username: string | null = null
  if (token) {
    try {
      username = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).username ?? null
    } catch {}
  }
  useState('username', () => username)
})
