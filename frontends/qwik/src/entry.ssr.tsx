/** SSR entry: renders the app to a stream (the Node adapter pipes it to the response). */
import { renderToStream, type RenderToStreamOptions } from '@builder.io/qwik/server';
import Root from './root';

export default function (opts: RenderToStreamOptions) {
	return renderToStream(<Root />, {
		...opts,
		containerAttributes: { lang: 'en', ...opts.containerAttributes },
		serverData: { ...opts.serverData }
	});
}
