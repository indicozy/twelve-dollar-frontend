<script setup lang="ts">
// Set per request on the server from the httpOnly `token` cookie (plugins/session.server.ts), sent in the payload.
const username = useState<string | null>('username', () => null)
</script>

<template>
  <header class="top">
    <NuxtLink to="/" class="brand">feed<span>.</span></NuxtLink>
    <span class="stack">nuxt</span>
    <nav>
      <span v-if="username" class="who">@{{ username }}</span>
      <NuxtLink v-else to="/login">Sign in</NuxtLink>
    </nav>
  </header>
</template>
