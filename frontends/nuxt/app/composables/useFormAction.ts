import type { ActionResult } from '#shared/types/post'

/**
 * Progressive enhancement for the like/compose forms (the counterpart of SvelteKit's `use:enhance` and Next.js
 * form actions): without JS the form posts normally and the server redirects back; with JS the form is posted with
 * fetch and the page's data is refetched (refreshNuxtData).
 */
export function useFormAction(onResult?: (result: ActionResult) => void) {
  const pending = ref(false)
  async function submit(event: Event) {
    const form = event.currentTarget as HTMLFormElement
    pending.value = true
    try {
      const result = await $fetch<ActionResult>(form.getAttribute('action')!, {
        method: 'POST',
        body: new FormData(form),
        headers: { accept: 'application/json' },
      })
      if (result.redirect) return navigateTo(result.redirect)
      onResult?.(result)
      if (!result.error) await refreshNuxtData()
    } finally {
      pending.value = false
    }
  }
  return { pending, submit }
}
