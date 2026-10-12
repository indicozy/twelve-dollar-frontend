<x-layout>
<form method="POST" action="/posts" class="compose">
@csrf
<textarea name="body" maxlength="500" placeholder="What's happening on the $12 server?" required rows="3"></textarea>
<div>
@if ($error)
<span class="error">{{ $error }}</span>
@else
<span class="muted">max 500 chars</span>
@endif
<button type="submit">Post</button>
</div>
</form>
<h1>Latest</h1>
<section class="feed">
@foreach ($posts as $post)
<x-post-card :post="$post" />
@endforeach
</section>
</x-layout>
