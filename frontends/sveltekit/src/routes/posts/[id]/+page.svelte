<script lang="ts">
	import PostCard from '#lib/PostCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<a href="/" class="back">← back to feed</a>
<PostCard post={data.post} link={false} />
