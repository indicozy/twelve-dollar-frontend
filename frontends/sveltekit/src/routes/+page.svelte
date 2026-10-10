<script lang="ts">
	import { enhance } from '$app/forms';
	import PostCard from '#lib/PostCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<form
	method="POST"
	action="?/create"
	class="compose"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
>
	<textarea name="body" maxlength="500" placeholder="What's happening on the $12 server?" required rows="3"></textarea>
	<div>
		{#if form?.error}
			<span class="error">{form.error}</span>
		{:else}
			<span class="muted">max 500 chars</span>
		{/if}
		<button type="submit" disabled={pending}>{pending ? 'Posting…' : 'Post'}</button>
	</div>
</form>
<h1>Latest</h1>
<section class="feed">
	{#each data.posts as post (post.id)}
		<PostCard {post} />
	{/each}
</section>
