import { component$ } from '@builder.io/qwik';
import { Form, routeAction$ } from '@builder.io/qwik-city';
import { signToken, TOKEN_COOKIE } from '../../lib/server/session';

export const useLogin = routeAction$((form, { cookie, redirect }) => {
	const id = Number(form.user_id);
	const username = String(form.username ?? '').trim();
	if (!Number.isInteger(id) || id < 1 || !username) throw redirect(303, '/login?error=1');
	cookie.set(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: 'lax', path: '/', secure: false });
	throw redirect(303, '/');
});

export default component$(() => {
	const login = useLogin();
	return (
		<Form action={login} class="login">
			<h1>Sign in</h1>
			<p class="muted">The API has no login endpoint; this signs a demo HS256 token (like the challenge's seed tokens).</p>
			<label>
				User id <input name="user_id" type="number" min="1" value="1" required />
			</label>
			<label>
				Username <input name="username" value="golden_ember_1" required />
			</label>
			<button type="submit">Continue</button>
		</Form>
	);
});
