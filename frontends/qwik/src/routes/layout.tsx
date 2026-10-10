import { component$, Slot } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { currentUsername } from '../lib/server/session';

// Signed-in name for the header: read from the `token` cookie on every request (like the Next.js layout).
// No `onGet` with `cacheControl` here (the Qwik starters add one): responses carry no caching headers.
export const useUsername = routeLoader$(({ cookie }) => currentUsername(cookie));

export default component$(() => {
	const username = useUsername();
	return (
		<>
			<header class="top">
				<Link href="/" class="brand">
					feed<span>.</span>
				</Link>
				<span class="stack">qwik</span>
				<nav>
					{username.value ? (
						<span class="who">@{username.value}</span>
					) : (
						<Link href="/login">Sign in</Link>
					)}
				</nav>
			</header>
			<main>
				<Slot />
			</main>
		</>
	);
});
