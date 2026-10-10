<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Feed · SvelteKit</title>
	<meta name="description" content="SSR benchmark app: SvelteKit frontend over a Rust + SQLite feed API" />
</svelte:head>

<header class="top">
	<a href="/" class="brand">feed<span>.</span></a>
	<span class="stack">sveltekit</span>
	<nav>
		{#if data.username}
			<span class="who">@{data.username}</span>
		{:else}
			<a href="/login">Sign in</a>
		{/if}
	</nav>
</header>
<main>{@render children()}</main>
