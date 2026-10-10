<script setup lang="ts">
// Fetched on the server during SSR on every request (useFetch calls server/api/feed.get.ts in-process), embedded
// in the payload for hydration. No route rules, no caching.
const { data: posts, error } = await useFetch('/api/feed')
if (error.value) throw createError({ status: error.value.status ?? 500, statusText: 'Feed unavailable', fatal: true })
</script>

<template>
  <ComposeForm />
  <h1>Latest</h1>
  <section class="feed">
    <PostCard v-for="post in posts" :key="post.id" :post="post" />
  </section>
</template>
