/*
 * Broadway (software H.264) decoder worker - security fix F9, step 2.
 *
 * Pages used to fetch Decoder.js, patch its avc.wasm path and start it from a blob: URL,
 * because a blob worker has no base URL. This static file lives next to Decoder.js and
 * avc.wasm, so relative paths resolve here; no fetch, no source patching, no blob.
 * The locateFile hook is the same one the pages injected before.
 */
var Module = (typeof Module !== 'undefined' && Module) || {};
Module.locateFile = function (path) {
    if (/\.wasm$/.test(path)) {
        return self.location.href.replace(/[^\/]*$/, '') + 'avc.wasm';
    }
    return path;
};
importScripts('Decoder.js');
