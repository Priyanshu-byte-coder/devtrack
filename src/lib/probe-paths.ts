/**
 * Paths that only vulnerability scanners ask for: WordPress, PHP and leaked
 * config files. DevTrack serves none of them, and letting them through
 * rendered the full not-found page each time, spending Active CPU on bots.
 */
const PROBE_PATH =
  /^\/(?:wp-|wordpress|xmlrpc|phpmyadmin|cgi-bin|vendor\/phpunit|\.git(?:\/|$)|\.env|\.aws|\.ssh)|\.(?:php\d?|aspx?|jsp|cgi|env|ini|sql|bak|old|swp)$/i;

export function isProbePath(pathname: string): boolean {
  return PROBE_PATH.test(pathname);
}
