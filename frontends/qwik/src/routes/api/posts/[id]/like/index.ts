import type { RequestHandler } from '@builder.io/qwik-city';
import { likePost } from '../../../../../lib/server/api';

export const onPost: RequestHandler = async ({ request, params, json }) => {
	const { status, data } = await likePost(request.headers.get('authorization'), params.id);
	json(status, data);
};
