<script setup lang="ts">
import type { Post } from '#shared/types/post'

const { post, link = true } = defineProps<{ post: Post; link?: boolean }>()
const { submit } = useFormAction()
</script>

<template>
  <article class="post" :data-post-id="post.id">
    <header>
      <span class="author">@{{ post.author }}</span>
      <time :datetime="post.created_at">{{ formatDate(post.created_at) }}</time>
    </header>
    <p>{{ post.body }}</p>
    <footer>
      <form method="post" action="/actions/like" @submit.prevent="submit">
        <input type="hidden" name="id" :value="post.id">
        <button type="submit" class="like">♥ <span>{{ post.like_count }}</span></button>
      </form>
      <NuxtLink v-if="link" :to="`/posts/${post.id}`" :prefetch="false">#{{ post.id }}</NuxtLink>
      <span v-else class="muted">#{{ post.id }}</span>
    </footer>
  </article>
</template>
