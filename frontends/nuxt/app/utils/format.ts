const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export const formatDate = (iso: string) => `${fmt.format(new Date(iso))} UTC`
