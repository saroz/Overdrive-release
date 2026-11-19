// Node harness for app/src/main/assets/web/shared/on-actions.js (fake DOM). Run: cd web-ui && npm run test:on-actions
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const listeners = {};
function el(attrs, parent, props) {
    return Object.assign({ nodeType: 1, parentNode: parent || null, attrs: attrs || {},
        getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; } }, props || {});
}
const doc = { nodeType: 9, addEventListener(t, fn, cap) { assert.strictEqual(cap, false); listeners[t] = fn; } };
const calls = [];
const errors = [];
const win = {
    document: doc,
    console: { error: (m) => errors.push(String(m)) },
    Page: {
        name: 'Page',
        save(a, b, c) { calls.push(['save', this && this.name, a, b, c]); },
        stop(ev) { calls.push(['stop']); ev.cancelBubble = true; },
        nested: { deep(x) { calls.push(['deep', this === win.Page.nested, x]); } },
    },
    plain(x) { calls.push(['plain', x]); },
};
win.window = win;
const ctx = vm.createContext(win);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);

function fire(type, target) {
    const ev = { type, target, cancelBubble: false };
    listeners[type](ev);
    return ev;
}

// 1. literals, this.value, this.checked, receiver binding
const input = el({ 'data-on-change': "Page.save('key', this.value, this.checked)" }, doc, { value: '42', checked: true });
fire('change', input);
assert.deepStrictEqual(calls.pop(), ['save', 'Page', 'key', '42', true]);

// 2. numbers, booleans, null, escaped quote, empty args, global function
const b = el({ 'data-on-click': "Page.save(-1.5, false, null)" }, doc);
fire('click', b);
assert.deepStrictEqual(calls.pop(), ['save', 'Page', -1.5, false, null]);
fire('click', el({ 'data-on-click': "plain('it\\'s')" }, doc));
assert.deepStrictEqual(calls.pop(), ['plain', "it's"]);
fire('click', el({ 'data-on-click': 'Page.save();' }, doc));
assert.deepStrictEqual(calls.pop(), ['save', 'Page', undefined, undefined, undefined]);

// 3. this (element), event, dataset, deep receiver
const d = el({ 'data-on-click': 'Page.nested.deep(this.dataset.id)' }, doc, { dataset: { id: 'x7' } });
fire('click', d);
assert.deepStrictEqual(calls.pop(), ['deep', true, 'x7']);
const selfArg = el({ 'data-on-click': 'plain(this)' }, doc);
fire('click', selfArg);
assert.strictEqual(calls.pop()[1], selfArg);

// 4. bubbling: child svg (non-element text node) -> button -> card; both handlers, inner first
const card = el({ 'data-on-click': "plain('card')" }, doc);
const button = el({ 'data-on-click': "plain('button')" }, card);
const svg = el({}, button);
fire('click', { nodeType: 3, parentNode: svg });
assert.deepStrictEqual(calls.splice(0), [['plain', 'button'], ['plain', 'card']]);

// 5. stopPropagation stops outer handlers
const outer = el({ 'data-on-click': "plain('outer')" }, doc);
const inner = el({ 'data-on-click': 'Page.stop(event)' }, outer);
fire('click', inner);
assert.deepStrictEqual(calls.splice(0), [['stop']]);

// 6. only the matching event type runs
fire('input', el({ 'data-on-click': "plain('no')" }, doc));
assert.strictEqual(calls.length, 0);

// 7. anything that is not a single plain call is refused, never evaluated
for (const bad of ["alert(1); plain('x')", "plain(document.cookie)", "plain(1+1)", "window['plain'](1)",
                   "plain('x'", "Page.save(parseInt(this.value, 10))", "constructor.constructor('x')()"]) {
    fire('click', el({ 'data-on-click': bad }, doc));
}
assert.strictEqual(calls.length, 0, 'nothing ran: ' + JSON.stringify(calls));
assert.ok(errors.length >= 6);

// 7b. dangerous globals and prototype hops are refused even when they are plain calls
win.eval = () => calls.push(['eval']); win.setTimeout = () => calls.push(['st']); win.fetch = () => calls.push(['fetch']);
for (const bad of ["eval('1')", "setTimeout('x', 1)", "fetch('/api')", "Page.save.constructor('x')", "Page.__proto__.x()",
                   "location.assign('/x')", "document.write('x')", "window.plain('x')"]) {
    fire('click', el({ 'data-on-click': bad }, doc));
}
assert.strictEqual(calls.length, 0, 'denied: ' + JSON.stringify(calls));

// 8. missing function is reported, not thrown
errors.length = 0;
fire('click', el({ 'data-on-click': 'Nope.method(1)' }, doc));
assert.ok(errors[0].indexOf('not a function') >= 0);

// 9. go(): same-site paths only
win.location = { href: '/start' };
win.BYDOnActions.go('//evil.example/x');
win.BYDOnActions.go('javascript:alert(1)');
win.BYDOnActions.go('https://evil.example/');
assert.strictEqual(win.location.href, '/start');
fire('click', el({ 'data-on-click': "BYDOnActions.go('/automations')" }, doc));
assert.strictEqual(win.location.href, '/automations');

// 10. clickId presses the element with that id, ignores anything else
const pressed = [];
win.document.getElementById = (id) => (id === 'importFile' ? { click() { pressed.push(id); } } : null);
win.BYDOnActions.clickId('importFile');
win.BYDOnActions.clickId('missing');
win.BYDOnActions.clickId({});
assert.deepStrictEqual(pressed, ['importFile']);

console.log('on-actions: all checks passed');
