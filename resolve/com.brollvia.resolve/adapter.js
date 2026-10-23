/* Brollvia for DaVinci Resolve — Workflow Integration host adapter.
 *
 * Resolve runs Workflow Integration plugins in an Electron-style shell.
 * When the shell provides Node access (require('fs')), downloads are
 * written straight to a folder on disk — the folder from the panel's
 * "Download folder" preference, defaulting to the OS Downloads folder.
 * When Node is not available, the adapter falls back to a normal browser
 * download. Every outcome is reported to the panel log as it happened.
 *
 * Importing into the Media Pool is attempted only when the shell exposes
 * a Resolve scripting bridge this adapter can actually call; otherwise
 * the log says the file was saved and must be imported manually — the
 * adapter never claims an import that did not happen.
 */
(function (global) {
  'use strict';

  function makeHost() {
    function nodeRequire(name) {
      try {
        if (typeof require === 'function') return require(name);
        if (global.require) return global.require(name);
      } catch (e) { /* not a Node shell */ }
      return null;
    }
    function store(k) { try { return global.localStorage.getItem('bv-panel-' + k); } catch (e) { return null; } }
    function storeSet(k, v) { try { global.localStorage.setItem('bv-panel-' + k, v); } catch (e) {} }

    var host = {
      name: 'resolve-workflow',
      log: function (line) { try { console.log('[Brollvia] ' + line); } catch (e) {} },
      storageGet: store,
      storageSet: storeSet,
      storageRemove: function (k) { try { global.localStorage.removeItem('bv-panel-' + k); } catch (e) {} },
      hostDark: function () {
        // Resolve's UI is dark; when detection is impossible, default the
        // panel to dark in this host only (the toggle can override).
        try {
          if (global.matchMedia) return global.matchMedia('(prefers-color-scheme: dark)').matches ? true : false;
        } catch (e) {}
        return true;
      },

      saveBytes: async function (filename, buffer) {
        var fs = nodeRequire('fs');
        var path = nodeRequire('path');
        var os = nodeRequire('os');
        if (fs && path && os) {
          try {
            var dir = store('download-dir') || path.join(os.homedir(), 'Downloads');
            fs.mkdirSync(dir, { recursive: true });
            var target = path.join(dir, filename);
            fs.writeFileSync(target, Buffer.from(buffer));
            host._lastPath = target;
            return { saved: true, note: 'Saved ' + filename + ' (' + buffer.byteLength + ' bytes) to ' + target + '.' };
          } catch (e) {
            return { saved: false, note: 'Writing the file with Node fs failed: ' + (e && e.message ? e.message : e) + ' The licence IS recorded — the file is in your Brollvia downloads history.' };
          }
        }
        // Fallback: a plain browser download through the shell.
        try {
          var blob = new Blob([buffer], { type: 'application/octet-stream' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          return { saved: true, note: 'This Resolve shell gave no Node fs access, so a browser-style download was started for ' + filename + ' (' + buffer.byteLength + ' bytes). Where it lands depends on the shell.' };
        } catch (e2) {
          return { saved: false, note: 'No file-writing path is available in this shell. The licence IS recorded — download the file from your Brollvia downloads history.' };
        }
      }
      // No importToProject: Resolve's Workflow Integration shell does not
      // hand HTML plugins a documented Media Pool import call this adapter
      // can make reliably, so the panel says plainly that the saved file
      // should be dragged into the Media Pool.
    };
    return host;
  }

  global.BrollviaResolveHost = makeHost;
})(typeof window !== 'undefined' ? window : this);
