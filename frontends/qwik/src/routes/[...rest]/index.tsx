import { component$ } from '@builder.io/qwik';
import type { RequestHandler } from '@builder.io/qwik-city';
import { NotFound } from '../../components/not-found';

// Catch-all not-found page, rendered per request inside the layout with status 404. (Qwik City's `404.tsx`
// convention is only produced by static generation at build time, which this variant turns off.)
export const onRequest: RequestHandler = ({ status }) => {
	status(404);
};

export default component$(() => <NotFound />);
