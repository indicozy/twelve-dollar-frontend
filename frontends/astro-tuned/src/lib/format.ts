// One formatter per process. The component frontmatter runs on every render, so a formatter created there
// would be constructed once per post card per request (ICU work + native memory each time).
export const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
