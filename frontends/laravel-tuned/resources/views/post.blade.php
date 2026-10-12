<x-layout>
<a href="/" class="back">← back to feed</a>
@include('partials.post-card', ['post' => $post, 'link' => false])
</x-layout>
