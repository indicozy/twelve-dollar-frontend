<script setup lang="ts">
// The whole page is rendered before anything is sent (no streaming), so a missing or invalid post is a real 404.
const route = useRoute()
const { data: post, error } = await useFetch(() => `/api/posts/${encodeURIComponent(String(route.params.id))}`)
if (error.value || !post.value) {
  throw createError({ status: error.value?.status ?? 404, statusText: 'Not found', fatal: true })
}
</script>

<template>
  <NuxtLink to="/" class="back">← back to feed</NuxtLink>
  <PostCard v-if="post" :post="post" :link="false" />
</template>
