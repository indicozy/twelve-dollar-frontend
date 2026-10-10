<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Post } from '#lib/server/api.ts';

	let { post, link = true }: { post: Post; link?: boolean } = $props();

	const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
</script>

<article class="post" data-post-id={post.id}>
	<header>
		<span class="author">@{post.author}</span>
		<time datetime={post.created_at}>{fmt.format(new Date(post.created_at))} UTC</time>
	</header>
	<p>{post.body}</p>
	<footer>
		<form method="POST" action="?/like" use:enhance>
			<input type="hidden" name="id" value={post.id} />
			<button type="submit" class="like">♥ <span>{post.like_count}</span></button>
		</form>
		{#if link}
			<a href="/posts/{post.id}">#{post.id}</a>
		{:else}
			<span class="muted">#{post.id}</span>
		{/if}
	</footer>
</article>
