{{-- Tuned: an @include partial instead of the <x-post-card> component (20 per feed page). Same markup; skips the
     component machinery (attribute bag, props, component stack) for every card. --}}
@php($link ??= true)
{{-- Date text matches Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC". --}}
<article class="post" data-post-id="{{ $post['id'] }}">
<header>
<span class="author">{{ '@'.$post['author'] }}</span>
<time datetime="{{ $post['created_at'] }}">{{ (new DateTimeImmutable($post['created_at']))->setTimezone(new DateTimeZone('UTC'))->format('M j, Y, g:i A') }} UTC</time>
</header>
<p>{{ $post['body'] }}</p>
<footer>
<form method="POST" action="/like">
@csrf
<input type="hidden" name="id" value="{{ $post['id'] }}">
<button type="submit" class="like">♥ <span>{{ $post['like_count'] }}</span></button>
</form>
@if ($link)
<a href="/posts/{{ $post['id'] }}">#{{ $post['id'] }}</a>
@else
<span class="muted">#{{ $post['id'] }}</span>
@endif
</footer>
</article>
