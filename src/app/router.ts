// 해시 라우팅 (design.md A3, §5.1): #/ · #/p/12 · #/settings · 개발 빌드에서 #/p/12?reveal
import { useSyncExternalStore } from 'react';
import { TOTAL_PUZZLES } from '../data/stages';

export type Route =
  | { name: 'home' }
  | { name: 'puzzle'; number: number; reveal: boolean }
  | { name: 'settings' };

export function parseHash(hash: string, allowReveal = import.meta.env.DEV): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  if (path === '/settings') return { name: 'settings' };
  const m = path.match(/^\/p\/(\d{1,2})$/);
  if (m) {
    const number = Number(m[1]);
    if (number >= 1 && number <= TOTAL_PUZZLES) {
      const reveal = allowReveal && new URLSearchParams(query).has('reveal');
      return { name: 'puzzle', number, reveal };
    }
  }
  return { name: 'home' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'settings':
      return '#/settings';
    case 'puzzle':
      return `#/p/${route.number}`;
  }
}

export function navigate(route: Route) {
  window.location.hash = hrefFor(route);
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}
