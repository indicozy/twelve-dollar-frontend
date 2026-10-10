import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

import './global.css';

export default component$(() => (
	<QwikCityProvider>
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>Feed · Qwik</title>
			<meta name="description" content="SSR benchmark app: Qwik City frontend over a Rust + SQLite feed API" />
		</head>
		<body>
			<RouterOutlet />
		</body>
	</QwikCityProvider>
));
