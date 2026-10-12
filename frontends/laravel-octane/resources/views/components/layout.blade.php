{{-- The signed-in name comes from the `token` cookie's JWT payload, read on every request. --}}
@php($username = \App\Support\DemoToken::username(request()))
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Feed · Laravel</title>
<meta name="description" content="SSR benchmark app: Laravel frontend over a Rust + SQLite feed API">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="top">
<a href="/" class="brand">feed<span>.</span></a>
<span class="stack">laravel</span>
<nav>
@if ($username)
<span class="who">{{ '@'.$username }}</span>
@else
<a href="/login">Sign in</a>
@endif
</nav>
</header>
<main>{{ $slot }}</main>
</body>
</html>
