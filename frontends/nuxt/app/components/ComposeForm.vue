<script setup lang="ts">
const route = useRoute()
// A plain (no-JS) submit that fails is redirected to /?error=…; an enhanced one reports the error here.
const error = ref<string | null>(typeof route.query.error === 'string' ? route.query.error : null)
const { pending, submit } = useFormAction((result) => {
  error.value = result.error ?? null
})

async function onSubmit(event: Event) {
  const form = event.currentTarget as HTMLFormElement
  await submit(event)
  if (!error.value) form.reset()
}
</script>

<template>
  <form method="post" action="/actions/create" class="compose" @submit.prevent="onSubmit">
    <textarea name="body" maxlength="500" placeholder="What's happening on the $12 server?" required rows="3" />
    <div>
      <span v-if="error" class="error">{{ error }}</span>
      <span v-else class="muted">max 500 chars</span>
      <button type="submit" :disabled="pending">{{ pending ? 'Posting…' : 'Post' }}</button>
    </div>
  </form>
</template>
