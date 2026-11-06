// Checks for the static 404 page and the root index.html.
// Cloudflare Pages serves a top-level 404.html (with a real 404 status) for any
// unknown path instead of falling back to the homepage, so the file must work at
// any URL depth: every src and href has to be absolute, and it must not be indexed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const NOT_FOUND = new URL('../404.html', import.meta.url);
const INDEX = new URL('../index.html', import.meta.url);

// A src or href is fine when it starts with /, http, https, mailto, tel or #.
const ABSOLUTE_OK = /^(\/|https?:|mailto:|tel:|#)/i;

function attrValues(html, attr) {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'gi');
  return [...html.matchAll(re)].map((m) => (m[1] !== undefined ? m[1] : m[2]));
}

function relativeRefs(html) {
  return [...attrValues(html, 'src'), ...attrValues(html, 'href')].filter((v) => !ABSOLUTE_OK.test(v.trim()));
}

test('404.html exists at the repo root', () => {
  assert.ok(existsSync(NOT_FOUND), '404.html is missing');
});

test('404.html is noindex, has no canonical, and has the expected title', () => {
  const html = readFileSync(NOT_FOUND, 'utf8');
  assert.match(html, /<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"\s*>/i, 'noindex meta tag');
  assert.ok(!/rel\s*=\s*["']canonical["']/i.test(html), 'no canonical link');
  assert.match(html, /<title>Page not found \| MEDJAY<\/title>/, 'title');
});

test('404.html has no relative src or href (works at any URL depth)', () => {
  const html = readFileSync(NOT_FOUND, 'utf8');
  assert.deepEqual(relativeRefs(html), [], 'relative src/href found in 404.html');
  // Also catch relative url(...) in inline CSS.
  const badCss = [...html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1]).filter((v) => !/^(\/|https?:|data:|#)/i.test(v));
  assert.deepEqual(badCss, [], 'relative url() found in 404.html');
});

test('404.html content: heading, one line, and three links', () => {
  const html = readFileSync(NOT_FOUND, 'utf8');
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  assert.ok(main, 'has <main>');
  assert.match(main[1], /<h1[^>]*>Page not found<\/h1>/);
  assert.match(main[1], /This page does not exist or has moved\./);
  const links = [...main[1].matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [['/', 'Home'], ['/courses/', 'Free Courses'], ['/programs/', 'Programs']]);
});

test('root index.html has no relative src or href (works when served at any URL depth)', () => {
  const html = readFileSync(INDEX, 'utf8');
  assert.deepEqual(relativeRefs(html), [], 'relative src/href found in index.html');
  assert.ok(html.includes('<img src="/assets/medjay-mark-nav.png"'), 'logo uses the absolute path');
});
