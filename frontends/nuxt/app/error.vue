<script setup lang="ts">
import type { NuxtError } from '#app'

// Rendered for unknown routes and missing/invalid posts, with the error's status (404). Like the SvelteKit
// variant's +error.svelte, it keeps the site header and shows "Not found".
defineProps<{ error: NuxtError }>()
</script>

<template>
  <AppHeader />
  <main>
    <div class="empty">
      <h1>Not found</h1>
      <NuxtLink to="/">← back to feed</NuxtLink>
    </div>
  </main>
</template>
