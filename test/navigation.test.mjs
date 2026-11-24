import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const render = file('../assets/js/render.js');
const site = file('../assets/js/site.js');
const mockElement = () => ({
  innerHTML: '',
  children: [],
  appendChild(child) { this.children.push(child); },
});

function renderNavigation(path) {
  const url = new URL(path, 'https://student-fork.example');
  const IDs = ['topnav', 'pager', 'footer', ...(path.includes('/pages/') ? [] : ['tochome'])];
  const nodes = Object.fromEntries(IDs.map(id => [id, mockElement()]));
  const callbacks = [];
  const context = {
    location: url,
    window: {},
    document: {
      readyState: 'loading',
      documentElement: { setAttribute() {} },
      body: { getAttribute() { return null; } },
      addEventListener(name, callback) {
        if (name === 'DOMContentLoaded') callbacks.push(callback);
      },
      getElementById(id) { return nodes[id] ?? null; },
      createElement: mockElement,
    },
  };
  runInNewContext(site, context);
  runInNewContext(render, context);
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  const resolve = (href) => new URL(href, url).pathname;
  const markupHrefs = (node) =>
    Array.from(node.innerHTML.matchAll(/href="([^"]+)"/g), match => resolve(match[1]));
  const elementHrefs = (node) => node.children.map(child => resolve(child.href));
  return {
    home: markupHrefs(nodes.topnav),
    footer: markupHrefs(nodes.footer),
    nav: elementHrefs(nodes.topnav.children[0]),
    cards: nodes.tochome ? elementHrefs(nodes.tochome) : [],
    pager: elementHrefs(nodes.pager),
  };
}

for (const prefix of ['', '/class-fork']) {
  for (const suffix of ['', '.html']) {
    test('chapter navigation at ' + prefix + '/pages/installation' + suffix, () => {
      const result = renderNavigation(prefix + '/pages/installation' + suffix);
      assert.deepEqual(result.home, [prefix + '/index.html']);
      assert.deepEqual(result.footer, result.home);
      assert.ok(result.nav.includes(prefix + '/pages/installation.html'));
      assert.ok(result.nav.every(path => path.startsWith(prefix + '/pages/') && !path.includes('/pages/pages/')));
      assert.deepEqual(result.pager, [
        prefix + '/pages/virtual-environment.html',
        prefix + '/pages/ide-setup.html',
      ]);
    });
  }
  test('home links stay on the same fork at ' + prefix + '/', () => {
    const result = renderNavigation(prefix + '/');
    assert.deepEqual(result.home, [prefix + '/index.html']);
    assert.deepEqual(result.footer, result.home);
    assert.ok(result.cards.includes(prefix + '/pages/installation.html'));
    assert.match(file('../index.md'), /\[Installation page\]\(pages\/installation\.html\)/);
    assert.match(file('../release/index.html'), /href="installation\.html">Installation page/);
  });
}
