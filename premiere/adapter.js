/* Brollvia for Premiere Pro — UXP host adapter.
 *
 * Everything here is defensive: UXP APIs differ across Premiere builds,
 * so every host capability is probed, and every outcome is reported to
 * the panel log exactly as it happened. Nothing in this file claims a
 * save or an import that the host did not actually perform.
 */
(function (global) {
  'use strict';

  function makeHost() {
    var lastFolder = null;   // UXP Folder entry chosen for downloads
    var lastPath = null;     // native path of the last saved file

    function uxp() {
      try { return typeof require === 'function' ? require('uxp') : null; } catch (e) { return null; }
    }
    function fs() {
      var u = uxp();
      try { return u && u.storage && u.storage.localFileSystem ? u.storage.localFileSystem : null; } catch (e) { return null; }
    }

    var host = {
      name: 'premiere-uxp',
      log: function (line) { try { console.log('[Brollvia] ' + line); } catch (e) {} },

      /* UXP panels provide window.localStorage; use it for the API key
       * and prefs (that is the plugin's local storage). */
      storageGet: function (k) { try { return global.localStorage.getItem('bv-panel-' + k); } catch (e) { return null; } },
      storageSet: function (k, v) { try { global.localStorage.setItem('bv-panel-' + k, v); } catch (e) {} },
      storageRemove: function (k) { try { global.localStorage.removeItem('bv-panel-' + k); } catch (e) {} },

      hostDark: function () {
        try {
          if (global.matchMedia) return global.matchMedia('(prefers-color-scheme: dark)').matches ? true : false;
        } catch (e) {}
        return null;
      },

      saveBytes: async function (filename, buffer, contentType) {
        var lfs = fs();
        if (!lfs) {
          return { saved: false, note: 'UXP localFileSystem is not available in this Premiere build, so the file could not be written. The licence IS recorded — download the file from your Brollvia downloads history instead.' };
        }
        try {
          if (!lastFolder) {
            lastFolder = await lfs.getFolder();   // native folder picker
            if (!lastFolder) return { saved: false, note: 'No download folder was chosen, so nothing was written. The licence IS recorded — the file is in your Brollvia downloads history.' };
          }
          var file = await lastFolder.createFile(filename, { overwrite: true });
          await file.write(buffer, { format: (uxp() && uxp().storage && uxp().storage.formats) ? uxp().storage.formats.binary : undefined });
          lastPath = file.nativePath || (lastFolder.nativePath ? lastFolder.nativePath + '/' + filename : filename);
          return { saved: true, note: 'Saved ' + filename + ' (' + buffer.byteLength + ' bytes) to ' + lastPath + '.' };
        } catch (e) {
          return { saved: false, note: 'Writing the file failed in UXP: ' + (e && e.message ? e.message : e) + ' The licence IS recorded — the file is in your Brollvia downloads history.' };
        }
      },

      /* Attempt a real import into the active Premiere project via the
       * UXP Premiere Pro API when this build exposes it. Any failure is
       * reported plainly — the panel never pretends an import happened. */
      importToProject: async function (filename) {
        var ppro = null;
        try { ppro = typeof require === 'function' ? require('premierepro') : null; } catch (e) { ppro = null; }
        if (!ppro || !ppro.Project) {
          return { done: false, note: 'this Premiere build does not expose the UXP Premiere Pro API (require("premierepro") unavailable).' };
        }
        if (!lastPath) {
          return { done: false, note: 'no saved file path is known, so there was nothing to import.' };
        }
        try {
          var project = await ppro.Project.getActiveProject();
          if (!project) return { done: false, note: 'no active project is open.' };
          if (typeof project.importFiles === 'function') {
            await project.importFiles([lastPath]);
            return { done: true, note: 'Premiere imported ' + filename + ' into the active project from ' + lastPath + '.' };
          }
          return { done: false, note: 'the Premiere UXP API in this build has no Project.importFiles method.' };
        } catch (e) {
          return { done: false, note: 'the Premiere import call failed: ' + (e && e.message ? e.message : e) };
        }
      }
    };
    return host;
  }

  global.BrollviaPremiereHost = makeHost;
})(typeof window !== 'undefined' ? window : this);
