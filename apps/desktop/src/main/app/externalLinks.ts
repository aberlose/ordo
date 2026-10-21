/** Schemes a link of the notes may open, in the system browser or mail app. */
const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Whether `url` is an external link to hand to the system (`shell.openExternal`); never the app's own. */
export function isExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
