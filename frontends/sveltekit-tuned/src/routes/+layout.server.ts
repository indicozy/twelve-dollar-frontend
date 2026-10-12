import { currentUsername } from '#lib/server/session.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies }) => ({ username: currentUsername(cookies) });
