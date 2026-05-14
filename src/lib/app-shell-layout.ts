/**
 * Horizontal bounds for AppShell main + bottom nav row + fixed in-app strips (chat, community, etc.).
 * Capped on large screens (~48rem) so chat, cards, and forms stay readable — not full-monitor stretch.
 */
export const APP_SHELL_CONTENT_WIDTH =
  "mx-auto w-full min-w-0 max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-3xl px-2 sm:px-4 lg:px-6";
