// Read endpoint behind useFetch('/api/feed') on the feed page. During SSR, useFetch calls it in-process (no HTTP
// hop); after hydration (refreshNuxtData, client navigation) the browser calls it over HTTP.
import { getFeed } from '../utils/api'

export default defineEventHandler(() => getFeed())
