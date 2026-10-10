// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import type { RequestHandler } from '@builder.io/qwik-city';
import { createPost } from '../../../lib/server/api';

export const onPost: RequestHandler = async ({ request, json }) => {
	const authorization = request.headers.get('authorization');
	let body = '';
	try {
		body = String((await request.json()).body ?? '');
	} catch {
		json(400, { error: 'malformed JSON body' });
		return;
	}
	const { status, data } = await createPost(authorization, body);
	json(status, data);
};
