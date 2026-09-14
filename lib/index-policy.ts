import { stripLocale } from '@/lib/i18n/config';

const excludedRoots = ['/account', '/library', '/checkout', '/admin', '/api', '/search'];

export function shouldNoIndex(pathname: string): boolean {
  const path = stripLocale(pathname);
  return excludedRoots.some(root => path === root || path.startsWith(`${root}/`));
}
