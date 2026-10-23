/* Brollvia editor panel — shared core (v1.6.0).
 *
 * One UI + one API client for every host: Premiere Pro (UXP), DaVinci
 * Resolve (Workflow Integration shell) and a plain browser (the test
 * harness). Hosts differ only through a small adapter:
 *
 *   host.storageGet(key) / storageSet(key, value) / storageRemove(key)
 *       — may return a value or a Promise. Used for the API key + prefs.
 *   host.saveBytes(filename, arrayBuffer, contentType)
 *       — Promise resolving { saved: bool, note: string }. The note is
 *         shown in the panel log verbatim, so it must say what really
 *         happened (folder written, browser download started, …).
 *   host.importToProject(filename, arrayBuffer)   [optional]
 *       — Promise resolving { done: bool, note: string }. Adapters must
 *         only claim done:true when the host API actually imported the
 *         file; otherwise done:false with the reason.
 *   host.hostDark()                               [optional]
 *       — true/false when the host theme is detectable, else null.
 *
 * Downloads always run the same licence-recorded flow as the website:
 * POST /api/v1/assets/{id}/download writes the licence record server-side
 * and returns a signed, expiring file URL; the panel then fetches the
 * bytes. If the account's plan does not include the asset's tier, the API
 * answers 403 and the panel shows that message (the upsell) — no bytes
 * are fetched in that case.
 */
(function (global) {
  'use strict';
  var VERSION = '1.6.0';

  /* ---------------- default browser adapter ---------------- */
  function browserHost() {
    return {
      name: 'browser',
      storageGet: function (k) { try { return global.localStorage.getItem('bv-panel-' + k); } catch (e) { return null; } },
      storageSet: function (k, v) { try { global.localStorage.setItem('bv-panel-' + k, v); } catch (e) {} },
      storageRemove: function (k) { try { global.localStorage.removeItem('bv-panel-' + k); } catch (e) {} },
      saveBytes: function (filename, buffer, contentType) {
        var blob = new Blob([buffer], { type: contentType || 'application/octet-stream' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        return Promise.resolve({ saved: true, note: 'Browser download started for ' + filename + ' (' + buffer.byteLength + ' bytes).' });
      },
      hostDark: function () {
        try { return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? true : false; } catch (e) { return null; }
      }
    };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function fmtDur(s) {
    if (s === null || s === undefined) return '';
    s = Math.round(Number(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function filenameFrom(headers, asset, variant) {
    var cd = headers.get ? headers.get('content-disposition') : null;
    if (cd) {
      var m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      if (m) { try { return decodeURIComponent(m[1].trim()); } catch (e) { return m[1].trim(); } }
    }
    var ext = (asset.format || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext) ext = asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'jpg';
    return (asset.slug || 'brollvia-asset') + '-' + (variant || 'hd') + '.' + ext;
  }

  function createPanel(root, options) {
    options = options || {};
    var host = options.host || browserHost();
    var state = {
      base: (options.defaultBase || '').replace(/\/+$/, ''),
      key: '',
      me: null,
      collections: [],
      fileUnder: '',       // collection id chosen in the picker ('' = none)
      results: [],
      current: null,       // full asset in the detail view
      theme: null
    };
    var logs = [];
    function log(msg) {
      var line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      logs.push(line);
      if (logs.length > 200) logs.shift();
      var ul = root.querySelector('.bv-loglist');
      if (ul) { var li = el('li', null, line); ul.appendChild(li); ul.scrollTop = ul.scrollHeight; }
      if (typeof host.log === 'function') { try { host.log(line); } catch (e) {} }
    }
    function storage(k) { return Promise.resolve(host.storageGet ? host.storageGet(k) : null); }
    function storageSet(k, v) { return Promise.resolve(host.storageSet ? host.storageSet(k, v) : null); }

    /* ---------- API ---------- */
    function api(path, opts) {
      opts = opts || {};
      var headers = { 'Accept': 'application/json' };
      if (state.key) headers['Authorization'] = 'Bearer ' + state.key;
      var init = { method: opts.method || 'GET', headers: headers };
      if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
      return fetch(state.base + '/api/v1/' + path, init).then(function (res) {
        return res.text().then(function (txt) {
          var json = null;
          try { json = JSON.parse(txt); } catch (e) {}
          if (!res.ok) {
            var msg = (json && json.error && json.error.message) || ('Request failed (HTTP ' + res.status + ')');
            var err = new Error(msg); err.status = res.status; err.payload = json; throw err;
          }
          return json ? json.data : null;
        });
      });
    }

    /* ---------- DOM ---------- */
    root.classList.add('bv-panel');
    root.innerHTML = '';

    var fontLink = document.createElement('style');
    fontLink.textContent = '';
    root.appendChild(fontLink);
    function loadFonts() {
      if (!state.base) return;
      fontLink.textContent =
        '@font-face{font-family:"Inter";src:url("' + state.base + '/assets/fonts/inter-400.woff2") format("woff2");font-weight:400}' +
        '@font-face{font-family:"Inter";src:url("' + state.base + '/assets/fonts/inter-600.woff2") format("woff2");font-weight:600}' +
        '@font-face{font-family:"Inter";src:url("' + state.base + '/assets/fonts/inter-800.woff2") format("woff2");font-weight:800}';
    }

    var head = el('div', 'bv-head');
    var brand = el('span', 'bv-brand'); brand.innerHTML = 'Brollvia<span class="bv-dot">.</span>';
    head.appendChild(brand);
    head.appendChild(el('span', 'bv-spacer'));
    var planBadge = el('span', 'bv-plan bv-hidden', 'Not connected');
    head.appendChild(planBadge);
    var themeBtn = el('button', 'bv-iconbtn', 'Theme');
    themeBtn.title = 'Toggle light / dark';
    head.appendChild(themeBtn);
    var settingsBtn = el('button', 'bv-iconbtn', 'Connection');
    head.appendChild(settingsBtn);
    root.appendChild(head);

    /* connection card */
    var conn = el('div', 'bv-card');
    conn.innerHTML = '<h3>Connect your Brollvia account</h3>' +
      '<p>Paste an API key from <strong>Dashboard → Developer</strong> on your Brollvia site. Keys are scoped and revocable; the panel stores the key only in this plugin\'s local storage.</p>';
    var lab1 = el('label', 'bv-lab', 'Brollvia site URL'); conn.appendChild(lab1);
    var baseInput = el('input'); baseInput.type = 'url'; baseInput.placeholder = 'https://brollvia.com';
    conn.appendChild(baseInput);
    var lab2 = el('label', 'bv-lab', 'API key'); conn.appendChild(lab2);
    var keyInput = el('input'); keyInput.type = 'password'; keyInput.placeholder = 'bv_live_…';
    keyInput.setAttribute('autocomplete', 'off');
    conn.appendChild(keyInput);
    var connStatus = el('div', 'bv-status', '');
    conn.appendChild(connStatus);
    var connRow = el('div', 'bv-row');
    var connectBtn = el('button', 'bv-btn', 'Connect');
    var disconnectBtn = el('button', 'bv-btn bv-ghost bv-hidden', 'Disconnect');
    connRow.appendChild(connectBtn); connRow.appendChild(disconnectBtn);
    conn.appendChild(connRow);
    root.appendChild(conn);

    /* main area */
    var main = el('div', 'bv-main bv-hidden');
    var toolbar = el('div', 'bv-toolbar');
    var q = el('input', 'bv-search'); q.type = 'text'; q.placeholder = 'Search B-roll, photos, music…';
    var searchBtn = el('button', 'bv-btn bv-narrow', 'Search');
    toolbar.appendChild(q); toolbar.appendChild(searchBtn);
    main.appendChild(toolbar);
    var filters = el('div', 'bv-filters');
    var typeSel = el('select');
    [['', 'All types'], ['video', 'Video'], ['photo', 'Photos'], ['audio', 'Music & SFX']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; typeSel.appendChild(op);
    });
    var oriSel = el('select');
    [['', 'Any orientation'], ['landscape', 'Landscape'], ['portrait', 'Portrait'], ['square', 'Square']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; oriSel.appendChild(op);
    });
    filters.appendChild(typeSel); filters.appendChild(oriSel);
    main.appendChild(filters);

    var pickRow = el('div', 'bv-row');
    var pickWrap = el('div');
    pickWrap.appendChild(el('label', 'bv-lab', 'File downloads under (optional)'));
    var pickSel = el('select');
    var noneOp = el('option', null, 'No collection'); noneOp.value = ''; pickSel.appendChild(noneOp);
    pickWrap.appendChild(pickSel);
    pickRow.appendChild(pickWrap);
    var newColWrap = el('div', 'bv-narrow');
    newColWrap.appendChild(el('label', 'bv-lab', ' '));
    var newColBtn = el('button', 'bv-btn bv-ghost', '+ New');
    newColWrap.appendChild(newColBtn);
    pickRow.appendChild(newColWrap);
    main.appendChild(pickRow);
    var newColRow = el('div', 'bv-row bv-hidden');
    var newColInput = el('input'); newColInput.type = 'text'; newColInput.placeholder = 'New collection name';
    var newColGo = el('button', 'bv-btn bv-narrow', 'Create');
    newColRow.appendChild(newColInput); newColRow.appendChild(newColGo);
    main.appendChild(newColRow);

    var status = el('div', 'bv-status', '');
    main.appendChild(status);
    var grid = el('div', 'bv-grid');
    main.appendChild(grid);
    var empty = el('div', 'bv-empty bv-hidden', 'No results yet — try a search.');
    main.appendChild(empty);

    /* detail view */
    var detail = el('div', 'bv-detail bv-hidden');
    var backBtn = el('button', 'bv-btn bv-ghost', '← Back to results');
    detail.appendChild(backBtn);
    var poster = el('img', 'bv-poster'); poster.alt = '';
    detail.appendChild(poster);
    var dTitle = el('h2', null, '');
    detail.appendChild(dTitle);
    var dBadges = el('div'); detail.appendChild(dBadges);
    var dSpecs = el('p', 'bv-specs', '');
    detail.appendChild(dSpecs);
    var dDesc = el('p', null, '');
    detail.appendChild(dDesc);
    var wantWrap = el('div');
    wantWrap.appendChild(el('label', 'bv-lab', 'Download size'));
    var wantSel = el('select');
    [['hd', 'HD (plan default)'], ['original', 'Original file']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; wantSel.appendChild(op);
    });
    wantWrap.appendChild(wantSel);
    detail.appendChild(wantWrap);
    var dlBtn = el('button', 'bv-btn bv-block', 'Download (records a licence)');
    detail.appendChild(dlBtn);
    var dStatus = el('div', 'bv-status', '');
    detail.appendChild(dStatus);
    main.appendChild(detail);
    root.appendChild(main);

    var logBox = el('details', 'bv-log');
    var logSum = el('summary', null, 'Panel log — what this panel actually did');
    logBox.appendChild(logSum);
    var logList = el('ul', 'bv-loglist');
    logBox.appendChild(logList);
    root.appendChild(logBox);

    function setStatus(node, msg, kind) {
      node.textContent = msg || '';
      node.className = 'bv-status' + (kind ? ' bv-' + kind : '');
    }
    function showMain(connected) {
      conn.classList.toggle('bv-hidden', connected);
      main.classList.toggle('bv-hidden', !connected);
      planBadge.classList.toggle('bv-hidden', !connected);
      disconnectBtn.classList.toggle('bv-hidden', !connected);
    }
    function applyTheme(t) {
      state.theme = t;
      root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
      themeBtn.textContent = t === 'dark' ? 'Light' : 'Dark';
    }

    /* ---------- behaviour ---------- */
    themeBtn.addEventListener('click', function () {
      var next = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next); storageSet('theme', next);
    });
    settingsBtn.addEventListener('click', function () { conn.classList.toggle('bv-hidden'); });

    function connect(base, key, quiet) {
      state.base = (base || '').replace(/\/+$/, '');
      state.key = key || '';
      if (!state.base) { setStatus(connStatus, 'Enter your Brollvia site URL first.', 'error'); return Promise.resolve(false); }
      if (!state.key) { setStatus(connStatus, 'Paste an API key from Dashboard → Developer.', 'error'); return Promise.resolve(false); }
      loadFonts();
      setStatus(connStatus, 'Connecting…');
      return api('me').then(function (me) {
        state.me = me;
        planBadge.textContent = (me.plan ? me.plan.name : 'Connected') + ' plan';
        setStatus(connStatus, 'Connected as ' + (me.name || me.email) + '.', 'ok');
        log('Connected to ' + state.base + ' as ' + (me.email || me.name) + ' (' + (me.plan ? me.plan.name : '?') + ' plan).');
        return storageSet('base', state.base).then(function () { return storageSet('key', state.key); }).then(function () {
          showMain(true);
          return refreshCollections().then(function () { return doSearch(); }).then(function () { return true; });
        });
      }).catch(function (err) {
        setStatus(connStatus, err.message, 'error');
        log('Connection failed: ' + err.message);
        return false;
      });
    }
    connectBtn.addEventListener('click', function () { connect(baseInput.value.trim(), keyInput.value.trim()); });
    disconnectBtn.addEventListener('click', function () {
      state.key = ''; state.me = null;
      storage('key').then(function () {});
      if (host.storageRemove) host.storageRemove('key');
      keyInput.value = '';
      showMain(false);
      planBadge.textContent = 'Not connected';
      log('Disconnected. The API key was removed from this plugin\'s local storage (revoke it in Dashboard → Developer to retire it fully).');
    });

    function refreshCollections() {
      return api('collections?per_page=48').then(function (list) {
        state.collections = Array.isArray(list) ? list : [];
        var cur = pickSel.value;
        pickSel.innerHTML = '';
        var none = el('option', null, 'No collection'); none.value = ''; pickSel.appendChild(none);
        state.collections.forEach(function (c) {
          var op = el('option', null, c.title + ' (' + c.asset_count + ')'); op.value = String(c.id); pickSel.appendChild(op);
        });
        pickSel.value = cur;
      }).catch(function (err) { log('Could not load collections: ' + err.message); });
    }
    pickSel.addEventListener('change', function () { state.fileUnder = pickSel.value; });
    newColBtn.addEventListener('click', function () { newColRow.classList.toggle('bv-hidden'); newColInput.focus(); });
    newColGo.addEventListener('click', function () {
      var title = newColInput.value.trim();
      if (!title) return;
      newColGo.disabled = true;
      api('collections', { method: 'POST', body: { title: title, is_public: false } }).then(function (c) {
        log('Created collection "' + c.title + '" (id ' + c.id + ').');
        newColRow.classList.add('bv-hidden'); newColInput.value = '';
        return refreshCollections().then(function () { pickSel.value = String(c.id); state.fileUnder = String(c.id); });
      }).catch(function (err) { setStatus(status, err.message, 'error'); log('Collection create failed: ' + err.message); })
        .then(function () { newColGo.disabled = false; });
    });

    function tile(asset) {
      var b = el('button', 'bv-tile');
      var th = el('div', 'bv-thumb');
      var img = el('img'); img.alt = asset.title || ''; img.loading = 'lazy';
      if (asset.preview_url) img.src = asset.preview_url;
      th.appendChild(img);
      var badge = el('span', 'bv-badge ' + (asset.tier === 'pro' ? 'bv-pro' : 'bv-free'), asset.tier === 'pro' ? 'PRO' : 'FREE');
      th.appendChild(badge);
      if (asset.type === 'video' && asset.preview_url) {
        b.addEventListener('mouseenter', function () {
          try {
            var v = document.createElement('video');
            v.src = asset.preview_url; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
            v.className = img.className;
            th.replaceChild(v, img);
            var p = v.play(); if (p && p.catch) p.catch(function () {});
            b._bvVideo = v;
          } catch (e) { /* hover previews are best-effort per host */ }
        });
        b.addEventListener('mouseleave', function () {
          if (b._bvVideo) { try { th.replaceChild(img, b._bvVideo); } catch (e) {} b._bvVideo = null; }
        });
      }
      b.appendChild(th);
      var meta = el('div', 'bv-meta');
      meta.appendChild(el('div', 'bv-title', asset.title));
      var sub = asset.type + (asset.duration ? ' · ' + fmtDur(asset.duration) : '') +
        (asset.width && asset.height ? ' · ' + asset.width + '×' + asset.height : '');
      meta.appendChild(el('div', 'bv-sub', sub));
      b.appendChild(meta);
      b.addEventListener('click', function () { openDetail(asset.id); });
      return b;
    }

    function doSearch() {
      setStatus(status, 'Searching…');
      grid.innerHTML = ''; empty.classList.add('bv-hidden');
      detail.classList.add('bv-hidden'); grid.classList.remove('bv-hidden');
      var params = new URLSearchParams();
      if (q.value.trim()) params.set('q', q.value.trim());
      if (typeSel.value) params.set('type', typeSel.value);
      if (oriSel.value) params.set('orientation', oriSel.value);
      params.set('per_page', '24');
      return api('search?' + params.toString()).then(function (list) {
        state.results = Array.isArray(list) ? list : [];
        setStatus(status, state.results.length ? state.results.length + ' result' + (state.results.length === 1 ? '' : 's') : '');
        if (!state.results.length) { empty.classList.remove('bv-hidden'); empty.textContent = 'No assets match that search on ' + state.base + '.'; }
        state.results.forEach(function (a) { grid.appendChild(tile(a)); });
        log('Search "' + (q.value.trim() || '(browse)') + '" returned ' + state.results.length + ' assets.');
        return state.results;
      }).catch(function (err) {
        setStatus(status, err.message, 'error');
        log('Search failed: ' + err.message);
        return [];
      });
    }
    searchBtn.addEventListener('click', doSearch);
    q.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doSearch(); });
    typeSel.addEventListener('change', doSearch);
    oriSel.addEventListener('change', doSearch);

    function openDetail(id) {
      setStatus(status, 'Loading asset…');
      return api('assets/' + id).then(function (a) {
        state.current = a;
        setStatus(status, '');
        grid.classList.add('bv-hidden'); empty.classList.add('bv-hidden');
        detail.classList.remove('bv-hidden');
        poster.src = a.preview_url || '';
        poster.alt = a.title || '';
        dTitle.textContent = a.title;
        dBadges.innerHTML = '';
        var badge = el('span', 'bv-badge bv-static ' + (a.tier === 'pro' ? 'bv-pro' : 'bv-free'), a.tier === 'pro' ? 'PRO library' : 'Free');
        dBadges.appendChild(badge);
        var specs = [a.type, a.duration ? fmtDur(a.duration) : null,
          a.width && a.height ? a.width + '×' + a.height : null,
          a.shot_type || null, a.camera_movement || null].filter(Boolean).join(' · ');
        dSpecs.textContent = specs;
        dDesc.textContent = a.description || '';
        setStatus(dStatus, '');
        log('Opened asset #' + a.id + ' "' + a.title + '" (' + a.tier + ').');
        return a;
      }).catch(function (err) { setStatus(status, err.message, 'error'); });
    }
    backBtn.addEventListener('click', function () {
      detail.classList.add('bv-hidden'); grid.classList.remove('bv-hidden');
    });

    dlBtn.addEventListener('click', function () {
      var a = state.current; if (!a) return;
      var want = wantSel.value || 'hd';
      dlBtn.disabled = true;
      setStatus(dStatus, 'Requesting your licensed download…');
      log('Download requested for asset #' + a.id + ' (variant=' + want + '). Asking the API to record the licence…');
      api('assets/' + a.id + '/download', { method: 'POST', body: { variant: want } }).then(function (res) {
        var lic = res.licence || {};
        log('Licence recorded server-side: ' + (lic.code || '(code n/a)') + ' — variant "' + (res.variant || want) + '". Fetching the file bytes…');
        return fetch(res.download_url).then(function (fres) {
          if (!fres.ok) throw new Error('The signed file URL answered HTTP ' + fres.status + ' (it may have expired — try again).');
          var name = filenameFrom(fres.headers, a, res.variant);
          return fres.arrayBuffer().then(function (buf) { return { buf: buf, name: name, type: fres.headers.get('content-type') || '' }; });
        }).then(function (got) {
          return Promise.resolve(host.saveBytes(got.name, got.buf, got.type)).then(function (saved) {
            log('Save: ' + (saved && saved.note ? saved.note : (saved && saved.saved ? 'saved ' + got.name : 'host did not confirm the save')));
            setStatus(dStatus, saved && saved.saved ? 'Downloaded ' + got.name + ' — licence ' + (lic.code || '') + ' is in your Brollvia downloads history.' : 'The file could not be saved by this host — see the panel log.', saved && saved.saved ? 'ok' : 'error');
            if (typeof host.importToProject === 'function') {
              return Promise.resolve(host.importToProject(got.name, got.buf)).then(function (imp) {
                if (imp && imp.done) log('Import: ' + imp.note);
                else log('Import not done: ' + (imp && imp.note ? imp.note : 'the host provided no import path') + ' Import the saved file manually.');
              }).catch(function (e) { log('Import attempt errored: ' + e.message + ' Import the saved file manually.'); });
            }
            return null;
          });
        }).then(function () {
          if (state.fileUnder) {
            return api('collections/' + state.fileUnder + '/assets', { method: 'POST', body: { asset_id: a.id } }).then(function () {
              log('Filed asset #' + a.id + ' under collection #' + state.fileUnder + '.');
              return refreshCollections();
            }).catch(function (err) { log('Filing under the collection failed: ' + err.message); });
          }
          return null;
        });
      }).catch(function (err) {
        // 403 from the download endpoint is the plan gate: the API's own
        // message is the upsell — show it verbatim, fetch no bytes.
        setStatus(dStatus, err.message, 'error');
        log('Download stopped: ' + err.message + ' (No file was downloaded.)');
      }).then(function () { dlBtn.disabled = false; });
    });

    /* ---------- boot ---------- */
    var bootTheme = storage('theme');
    var bootBase = storage('base');
    var bootKey = storage('key');
    Promise.all([bootTheme, bootBase, bootKey]).then(function (vals) {
      var theme = vals[0];
      if (!theme && typeof host.hostDark === 'function') { try { theme = host.hostDark() ? 'dark' : 'light'; } catch (e) {} }
      applyTheme(theme || 'light');
      baseInput.value = vals[1] || state.base || '';
      if (vals[1]) state.base = String(vals[1]).replace(/\/+$/, '');
      loadFonts();
      if (vals[2]) { keyInput.value = vals[2]; connect(baseInput.value, vals[2], true); }
      else showMain(false);
      log('Brollvia panel v' + VERSION + ' ready in host "' + (host.name || 'browser') + '".');
    });

    return {
      version: VERSION,
      state: state,
      log: log,
      search: doSearch,
      connect: connect,
      openDetail: openDetail,
      host: host
    };
  }

  global.BrollviaPanel = { version: VERSION, create: createPanel, browserHost: browserHost };
})(typeof window !== 'undefined' ? window : this);
