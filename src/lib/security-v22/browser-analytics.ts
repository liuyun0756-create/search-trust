export function shouldInitializeBrowserAnalytics(pathname: string): boolean {
  return pathname !== "/share" && !pathname.startsWith("/share/");
}
