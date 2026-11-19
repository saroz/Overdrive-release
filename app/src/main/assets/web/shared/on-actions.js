/*
 * CSP-safe replacement for inline on*= handlers (security fix F9, step 4).
 *
 * Markup carries data-on-click / data-on-change / data-on-input with a single call:
 *     data-on-click="NetworkPage.saveSwitch('localOnly', 'hsLocalOnly')"
 * The callee is a dotted path looked up from window (never evaluated as code). Arguments may be
 * 'single-quoted strings', numbers, true / false / null, event, this, this.value, this.checked,
 * this.dataset.<name>. "this" means the element that carries the attribute, as it did for the
 * inline handler; the method's own receiver is the object before the last dot, also as before.
 *
 * Listeners sit on document in the bubble phase, so anything that stops an event earlier still
 * stops it here, as it did for inline handlers: e.g. settings-hydration.js swallows clicks in the
 * capture phase until a page has loaded its settings. Matching elements run from the target
 * outwards like bubbling, and stop if a handler calls event.stopPropagation(). ES5 (Chrome 58).
 */
(function () {
    'use strict';

    var TYPES = ['click', 'change', 'input'];
    // Never reachable from markup: code-from-string, navigation, network and prototype hops.
    var DENY_ROOT = /^(eval|Function|setTimeout|setInterval|setImmediate|execScript|location|document|window|self|top|parent|frames|globalThis|open|fetch|XMLHttpRequest|WebSocket|Worker|importScripts|postMessage|navigator|localStorage|sessionStorage|indexedDB)$/;
    var DENY_PART = /^(constructor|__proto__|prototype|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__)$/;
    var cache = {};

    function parseArgs(src) {
        var args = [];
        var i = 0;
        var n = src.length;
        function skip() { while (i < n && /\s/.test(src.charAt(i))) i++; }
        skip();
        if (i >= n) return args;
        for (;;) {
            skip();
            var c = src.charAt(i);
            if (c === "'") {
                var out = '';
                i++;
                while (i < n && src.charAt(i) !== "'") {
                    if (src.charAt(i) === '\\' && i + 1 < n) { i++; }
                    out += src.charAt(i);
                    i++;
                }
                if (i >= n) throw new Error('unterminated string');
                i++;
                args.push({ k: 'lit', v: out });
            } else {
                var m = /^(-?\d+(?:\.\d+)?|true|false|null|event|this(?:\.(?:value|checked|dataset\.[A-Za-z][\w]*))?)/.exec(src.slice(i));
                if (!m) throw new Error('unsupported argument at ' + i);
                var t = m[1];
                i += t.length;
                if (t === 'true') args.push({ k: 'lit', v: true });
                else if (t === 'false') args.push({ k: 'lit', v: false });
                else if (t === 'null') args.push({ k: 'lit', v: null });
                else if (t === 'event') args.push({ k: 'event' });
                else if (t.indexOf('this') === 0) args.push({ k: 'this', path: t === 'this' ? [] : t.slice(5).split('.') });
                else args.push({ k: 'lit', v: Number(t) });
            }
            skip();
            if (i >= n) break;
            if (src.charAt(i) !== ',') throw new Error('expected , at ' + i);
            i++;
        }
        return args;
    }

    function parse(spec) {
        if (cache.hasOwnProperty(spec)) return cache[spec];
        var m = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(([\s\S]*)\)\s*;?\s*$/.exec(spec);
        var parsed = null;
        if (m) {
            try {
                var path = m[1].split('.');
                var ok = !DENY_ROOT.test(path[0]);
                for (var k = 0; ok && k < path.length; k++) ok = !DENY_PART.test(path[k]);
                if (ok) parsed = { path: path, args: parseArgs(m[2]) };
            } catch (e) {
                parsed = null;
            }
        }
        if (!parsed && window.console) console.error('[on-actions] unsupported handler: ' + spec);
        cache[spec] = parsed;
        return parsed;
    }

    function run(el, spec, event) {
        var p = parse(spec);
        if (!p) return;
        var receiver = window;
        var fn = window;
        for (var i = 0; i < p.path.length; i++) {
            receiver = fn;
            fn = fn == null ? undefined : fn[p.path[i]];
        }
        if (typeof fn !== 'function') {
            if (window.console) console.error('[on-actions] not a function: ' + p.path.join('.'));
            return;
        }
        var values = [];
        for (var a = 0; a < p.args.length; a++) {
            var arg = p.args[a];
            if (arg.k === 'lit') values.push(arg.v);
            else if (arg.k === 'event') values.push(event);
            else {
                var v = el;
                for (var j = 0; j < arg.path.length && v != null; j++) v = v[arg.path[j]];
                values.push(v);
            }
        }
        fn.apply(receiver, values);
    }

    function handler(type) {
        var attr = 'data-on-' + type;
        return function (event) {
            var el = event.target;
            if (el && el.nodeType !== 1) el = el.parentNode;
            while (el && el.nodeType === 1) {
                var spec = el.getAttribute(attr);
                if (spec) {
                    try {
                        run(el, spec, event);
                    } catch (e) {
                        if (window.console) console.error(e);
                    }
                    if (event.cancelBubble) return;
                }
                el = el.parentNode;
            }
        };
    }

    for (var t = 0; t < TYPES.length; t++) {
        document.addEventListener(TYPES[t], handler(TYPES[t]), false);
    }

    /** Same-site navigation for markup ("/path" only; never another host or a javascript: URL). */
    function go(url) {
        if (typeof url === 'string' && /^\/(?!\/)/.test(url)) window.location.href = url;
    }

    window.BYDOnActions = { parse: parse, go: go };
})();
