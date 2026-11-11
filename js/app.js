/* My Flights — screen logic. Tickets, names and pictures stay on this device. */
(function () {
  'use strict';
  var APP_VERSION = '2.0 beta 3';
  var $ = function (id) { return document.getElementById(id); };
  var D = FlightData, T = FlightTime, S = FlightStatus;

  // ---------- tiny DOM helper (always textContent, never HTML from data) ----------
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== false && props[k] != null) n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(path, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path); s.appendChild(p);
    return s;
  }
  var PLANE = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';
  var PERSON = 'M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zm0 2c-4 0-8 2-8 5v1.4h16V19c0-3-4-5-8-5z';
  var CROSS = 'M6 6l12 12M18 6L6 18';

  // ---------- dates ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function niceDate(iso, long) {
    if (!iso) return 'Date missing';
    var d = parseIso(iso), sameYear = d.getFullYear() === new Date().getFullYear();
    var opt = long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
                   : { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' };
    return d.toLocaleDateString(undefined, opt);
  }
  function checkedText(ms) {
    var d = new Date(ms), same = d.toDateString() === new Date().toDateString();
    return 'Checked ' + (same ? 'today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) + ' at ' + clock(ms);
  }
  function clock(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  // ---------- what a ticket looks like right now (ticket + live status + time zones) ----------
  function view(t) {
    var live = t.live || null;
    var dep = { date: t.date, time: t.depTime }, arr = { date: '', time: t.arrTime }, oldDep = '', oldArr = '';
    if (live) {
      var d = live.dep.now || live.dep.sched, a = live.arr.now || live.arr.sched;
      if (d) {
        dep = { date: d.d, time: d.t };
        if (live.dep.sched && live.dep.sched.t !== d.t) oldDep = live.dep.sched.t;
        else if (t.depTime && t.depTime !== d.t) oldDep = t.depTime;
      }
      if (a) {
        arr = { date: a.d, time: a.t };
        if (live.arr.sched && live.arr.sched.t !== a.t) oldArr = live.arr.sched.t;
        else if (t.arrTime && t.arrTime !== a.t) oldArr = t.arrTime;
      }
    }
    var ex = T.exact(t.from, t.to, dep, arr);
    return { dep: dep, arr: { date: ex.arrDate, time: arr.time }, oldDep: oldDep, oldArr: oldArr, ex: ex, live: live, sum: S.summary(live) };
  }
  // 'past' | 'now' | 'upcoming'
  function phase(t, v) {
    var now = Date.now(), DAY = 864e5;
    if (v.ex.depMs != null) {
      var end = v.ex.arrMs != null ? v.ex.arrMs : v.ex.depMs + 6 * 36e5;
      if (now > end + DAY) return 'past';
      return now >= v.ex.depMs - DAY ? 'now' : 'upcoming';
    }
    if (!t.date) return 'upcoming';
    var n = T.dayDiff(todayIso(), t.date);
    return n < -1 ? 'past' : n <= 1 ? 'now' : 'upcoming';
  }
  function sortValue(t, v) { return v.ex.depMs != null ? v.ex.depMs : (t.date ? parseIso(t.date).getTime() : 9e15); }
  function badge(t, v) {
    var now = Date.now(), ex = v.ex, text, cls = 'badge';
    if (v.sum && v.sum.tone === 'bad') return null;
    if (ex.depMs != null) {
      var mins = Math.round((ex.depMs - now) / 6e4);
      if (mins > 48 * 60) text = 'in ' + Math.round(mins / 1440) + ' days';
      else if (mins >= 60) text = 'in ' + Math.floor(mins / 60) + ' h ' + pad(mins % 60) + ' min';
      else if (mins > 0) text = 'in ' + mins + ' min';
      else if (ex.arrMs != null && now < ex.arrMs) { text = 'In the air'; cls += ' today'; }
      else {
        var ago = Math.floor((now - (ex.arrMs || ex.depMs)) / 864e5);
        text = ago < 1 ? 'Landed' : ago === 1 ? 'Yesterday' : ago + ' days ago'; cls += ' past';
      }
      if (mins > 0 && mins <= 24 * 60) cls += ' today';
    } else if (t.date) {
      var n = T.dayDiff(todayIso(), t.date);
      text = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? 'in ' + n + ' days' : n === -1 ? 'Yesterday' : -n + ' days ago';
      if (n === 0) cls += ' today'; if (n < 0) cls += ' past';
    } else return null;
    return el('span', { class: cls, text: text });
  }

  // ---------- state ----------
  var tickets = [];
  var imageUrls = {};
  var form = null;
  var currentId = null;
  var tab = '';              // chosen tab; '' = pick automatically
  var autoBlocked = false;   // stop automatic checks after a key problem

  function toast(msg, undo) {
    var t = $('toast'), u = $('toast-undo');
    $('toast-text').textContent = msg;
    u.hidden = !undo;
    u.onclick = undo ? function () { t.hidden = true; undo(); } : null;
    t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, undo ? 6000 : 2600);
  }
  function imageUrl(imageId) {
    if (!imageId) return Promise.resolve('');
    if (imageUrls[imageId]) return Promise.resolve(imageUrls[imageId]);
    return TicketDB.getImage(imageId).then(function (rec) {
      if (!rec) return '';
      imageUrls[imageId] = URL.createObjectURL(new Blob([rec.data], { type: rec.type || 'image/png' }));
      return imageUrls[imageId];
    });
  }
  function byId(id) { return tickets.filter(function (x) { return x.id === id; })[0]; }

  // ---------- shared pieces of a ticket ----------
  function timeNode(time, old, zone, plus) {
    var kids = [];
    if (old) kids.push(el('s', { class: 'old-time', text: old, 'aria-label': 'was ' + old }));
    kids.push(el('span', { class: old ? 'new-time' : '', text: time || '' }));
    if (plus > 0) kids.push(el('sup', { class: 'plus', text: '+' + plus, 'aria-label': plus === 1 ? 'next day' : plus + ' days later' }));
    if (zone && time) kids.push(el('small', { class: 'zone', text: zone }));
    return el('div', { class: 'time' }, kids);
  }
  function airportEnd(code, city, right, timeEl) {
    var f = T.flag(code);
    return el('div', { class: 'end' + (right ? ' right' : '') }, [
      el('div', { class: 'code' }, [f && !right ? el('span', { class: 'flag', text: f }) : null, code || '—', f && right ? el('span', { class: 'flag', text: f }) : null]),
      el('div', { class: 'city', text: city || '' }),
      timeEl
    ]);
  }
  function midBlock(v) {
    var now = Date.now(), ex = v.ex, flying = ex.depMs != null && ex.arrMs != null && now >= ex.depMs && now < ex.arrMs;
    var line = el('div', { class: 'mid-line' }, [svg(PLANE)]);
    if (flying) line.style.setProperty('--p', Math.round((now - ex.depMs) / (ex.arrMs - ex.depMs) * 100) + '%');
    return el('div', { class: 'mid' + (flying ? ' flying' : '') }, [line, el('div', { class: 'dur', text: T.duration(ex.durMin) })]);
  }
  function routeBlock(t, v) {
    return el('div', { class: 'route' }, [
      airportEnd(t.from, t.fromCity, false, timeNode(v.dep.time, v.oldDep, v.ex.depZone, 0)),
      midBlock(v),
      airportEnd(t.to, t.toCity, true, timeNode(v.arr.time, v.oldArr, v.ex.arrZone, v.ex.dayShift))
    ]);
  }
  function statusRow(v) {
    if (!v.sum) return null;
    var live = v.live, bits = [];
    if (live.dep.terminal) bits.push('Terminal ' + live.dep.terminal);
    if (live.dep.gate) bits.push('Gate ' + live.dep.gate);
    return el('div', { class: 'status-row' }, [
      v.sum.text ? el('span', { class: 'pill ' + v.sum.tone, text: v.sum.text }) : null,
      el('span', { class: 'status-bits', text: bits.join(' · ') }),
      el('span', { class: 'checked', text: checkedText(live.checkedAt).replace('Checked today at', 'checked') })
    ]);
  }

  // ---------- home ----------
  function tile(t, v) {
    var flight = [t.airline, t.flightNumber].filter(Boolean).join(' · ');
    var pax = t.passengers && t.passengers.length;
    var label = [t.from, t.to].filter(Boolean).join(' to ') || t.flightNumber || 'ticket';
    var x = el('button', { class: 'tile-x', 'aria-label': 'Remove ' + label, onclick: function (e) { e.stopPropagation(); removeTicket(t); } }, [svg(CROSS)]);
    var soon = v.ex.depMs != null && v.ex.depMs - Date.now() < 24 * 36e5 && Date.now() < (v.ex.arrMs || v.ex.depMs);
    return el('div', { class: 'tile' + (soon ? ' soon' : ''), role: 'button', tabindex: '0', 'aria-label': 'Open ' + label,
      onclick: function () { openDetail(t.id); },
      onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(t.id); } } }, [
      el('div', { class: 'tile-top' }, [el('span', { class: 'when', text: niceDate(v.dep.date) }), el('span', { class: 'tile-top-right' }, [badge(t, v), x])]),
      routeBlock(t, v),
      statusRow(v),
      el('div', { class: 'tile-meta' }, [
        el('span', { class: 'flight', text: flight || 'Flight' }),
        t.pnr ? el('span', { class: 'pnr' }, [el('small', { text: 'Ref' }), t.pnr]) : null
      ]),
      el('div', { class: 'pax' + (pax ? '' : ' none') }, [svg(PERSON), el('span', { text: pax ? t.passengers.join(', ') : 'No travellers added' })])
    ]);
  }
  var EMPTY_TAB = { past: 'No past flights.', now: 'Nothing in the next 24 hours.', upcoming: 'No later flights.' };
  var lastShown = null, enterTimer = null;
  function render(animate) {
    var groups = { past: [], now: [], upcoming: [] };
    tickets.forEach(function (t) { var v = view(t); groups[phase(t, v)].push({ t: t, v: v, k: sortValue(t, v) }); });
    groups.now.sort(function (a, b) { return a.k - b.k; });
    groups.upcoming.sort(function (a, b) { return a.k - b.k; });
    groups.past.sort(function (a, b) { return b.k - a.k; });

    var has = tickets.length > 0;
    $('empty').hidden = has; $('tabs').hidden = !has; $('footnote').hidden = !has;
    var shown = tab || (groups.now.length ? 'now' : groups.upcoming.length ? 'upcoming' : 'past');
    Array.prototype.forEach.call($('tabs').children, function (b) {
      var k = b.getAttribute('data-tab');
      b.setAttribute('aria-selected', k === shown ? 'true' : 'false');
      b.lastElementChild.textContent = groups[k].length ? groups[k].length : '';
    });
    var list = $('list'); list.textContent = '';
    var enter = animate === true || shown !== lastShown;
    lastShown = shown;
    if (enter) { clearTimeout(enterTimer); enterTimer = setTimeout(function () { list.classList.remove('enter'); }, 1400); }
    list.className = 'tiles' + (shown === 'past' ? ' past' : '') + (enter || list.classList.contains('enter') ? ' enter' : '');
    if (has) groups[shown].forEach(function (g, i) { var n = tile(g.t, g.v); n.style.setProperty('--i', Math.min(i, 8)); list.appendChild(n); });
    $('tab-empty').hidden = !has || groups[shown].length > 0;
    $('tab-empty').textContent = EMPTY_TAB[shown];
    var st = S.getSettings();
    $('btn-refresh').hidden = !st.apiKey || !has;
    $('footnote').textContent = st.apiKey
      ? 'Tickets stay on this device. Status checks send only flight number and date.'
      : 'Stored only on this device. No account, no sync, no upload.';
  }
  function reload() { return TicketDB.allTickets().then(function (all) { tickets = all; render(); }); }
  function plainRender() { render(false); }

  // ---------- live status ----------
  function refreshOne(t) {
    return S.fetchStatus(t).then(function (live) {
      t.live = live; t.updatedAt = Date.now();
      return TicketDB.saveTickets([t], null);
    });
  }
  function wantsCheck(t, v) {          // worth asking about: from two days before until a few hours after landing
    if (!t.flightNumber || !t.date) return false;
    var now = Date.now();
    if (v.ex.depMs != null) return now > v.ex.depMs - 48 * 36e5 && now < (v.ex.arrMs || v.ex.depMs + 6 * 36e5) + 3 * 36e5;
    var n = T.dayDiff(todayIso(), t.date);
    return n >= 0 && n <= 2;
  }
  function refreshMany(list, quiet) {
    var ok = 0, lastErr = null, btn = $('btn-refresh');
    btn.classList.add('spin');
    return list.reduce(function (p, t) {
      return p.then(function () {
        if (lastErr && (lastErr.code === 'badkey' || lastErr.code === 'limit' || lastErr.code === 'offline' || lastErr.code === 'network')) return;
        return refreshOne(t).then(function () { ok++; }, function (e) { lastErr = e; });
      });
    }, Promise.resolve()).then(function () {
      btn.classList.remove('spin');
      if (lastErr && (lastErr.code === 'badkey' || lastErr.code === 'limit')) autoBlocked = true;
      render();
      if (currentId) openDetail(currentId, true);
      if (!quiet) toast(ok ? 'Status updated for ' + ok + (ok === 1 ? ' flight' : ' flights') : (lastErr ? lastErr.message : 'No flights close enough to check yet'));
    });
  }
  function refreshAll() {
    var list = tickets.filter(function (t) { return wantsCheck(t, view(t)); });
    refreshMany(list, false);
  }
  function autoCheck() {
    var st = S.getSettings();
    if (!st.apiKey || !st.autoCheck || autoBlocked || document.hidden || navigator.onLine === false) return;
    var now = Date.now();
    var due = tickets.filter(function (t) { return wantsCheck(t, view(t)) && (!t.live || now - t.live.checkedAt > 60 * 6e4); });
    if (due.length) refreshMany(due, true);
  }

  // ---------- add ----------
  function openAddSheet() { $('add-sheet').hidden = false; }
  function closeAddSheet() { $('add-sheet').hidden = true; }
  function setBusy(frac, text) {
    $('busy').hidden = false;
    if (text) $('busy-text').textContent = text;
    $('busy-bar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  }
  function emptyFlight() { return { airline: '', flightNumber: '', from: '', fromCity: '', to: '', toCity: '', date: '', depTime: '', arrTime: '' }; }

  var queue = [];
  function addFiles(list) { for (var i = 0; i < list.length; i++) queue.push(list[i]); nextFile(); }
  function nextFile() { if (form || !$('busy').hidden || !queue.length) return; handleFile(queue.shift()); }

  function handleFile(file) {
    if (!file) return;
    var pdf = TicketOCR.isPdf(file), what = pdf ? 'PDF' : 'screenshot';
    setBusy(0.02, pdf ? 'Opening PDF…' : 'Getting the reader ready…');
    var parsed = null, problem = '', result = null;
    TicketOCR.readFile(file, setBusy).then(function (r) {
      result = r; parsed = TicketParser.parseBest(r.texts);
    }).catch(function (e) {
      console.error(e);
      problem = (pdf && e && e.message) ? e.message
        : 'The ' + what + ' could not be read automatically. You can still type the details in — the picture will be kept with the ticket.';
    }).then(function () {
      var keep = result ? result.imageBlob : (pdf ? null : file);
      return keep ? keep.arrayBuffer().then(function (buf) { return { id: TicketDB.newId(), type: keep.type || 'image/png', data: buf }; }) : null;
    }).then(function (image) {
      $('busy').hidden = true;
      if (pdf && !result) { toast(problem); setTimeout(nextFile, 400); return; }
      parsed = parsed || { pnr: '', passengers: [], flights: [] };
      var note = problem, ok = false;
      if (!note) {
        if (!parsed.flights.length) note = 'No flight details were recognised in this ' + what + '. Please type them in below.';
        else {
          ok = true;
          note = 'Found ' + parsed.flights.length + (parsed.flights.length === 1 ? ' flight' : ' flights') +
            (parsed.passengers.length ? ' and ' + parsed.passengers.length + (parsed.passengers.length === 1 ? ' traveller' : ' travellers') : '') +
            '. Fields marked in orange need a look.';
          if (result.pages > result.pagesRead) note += ' Only the first ' + result.pagesRead + ' of ' + result.pages + ' pages were read.';
        }
      }
      if (queue.length) note += ' (' + queue.length + ' more to go after this one.)';
      openForm({
        mode: 'new', title: 'Check details', note: note, noteOk: ok, image: image, read: true,
        rawTexts: result ? result.texts : [],
        pnr: parsed.pnr, passengers: parsed.passengers.slice(),
        flights: parsed.flights.length ? parsed.flights : [emptyFlight()]
      });
    }).catch(function (e) {
      console.error(e); $('busy').hidden = true; toast('Could not open that file'); setTimeout(nextFile, 400);
    });
  }

  // ---------- form ----------
  // Why a field deserves a second look ('' = fine). Only used for tickets that were read automatically.
  function doubt(f, key) {
    if (!form || !form.read) return '';
    if (key === 'date') {
      if (!f.date) return 'not found';
      if (T.dayDiff(todayIso(), f.date) < -1) return 'in the past?';
    }
    if (key === 'from' && !f.from) return 'not found';
    if (key === 'to') { if (!f.to) return 'not found'; if (f.to === f.from) return 'same as From?'; }
    if (key === 'depTime' && !f.depTime) return 'not found';
    if (key === 'arrTime') { if (!f.arrTime) return 'not found'; if (f.arrTime === f.depTime) return 'same as Departs?'; }
    if (key === 'flightNumber' && !f.flightNumber) return 'not found';
    return '';
  }
  function mark(row, f, key) {
    var why = doubt(f, key), tag = row.querySelector('.why');
    row.classList.toggle('unsure', !!why);
    if (why && !tag) { tag = el('em', { class: 'why' }); row.appendChild(tag); }
    if (tag) { tag.textContent = why; tag.hidden = !why; }
  }
  function inputRow(label, f, key, attrs, transform) {
    var i = el('input', Object.assign({ type: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' }, attrs || {}));
    i.value = f[key] || '';
    var row = el('label', { class: 'row' }, [el('span', { text: label }), i]);
    i.addEventListener('input', function () { f[key] = transform ? transform(i.value) : i.value; row.classList.remove('missing'); mark(row, f, key); });
    mark(row, f, key);
    return row;
  }
  function airportRow(label, f, codeKey, cityKey) {
    var code = el('input', { type: 'text', class: 'code', maxlength: '3', placeholder: 'FRA', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': label + ' airport code' });
    var city = el('input', { type: 'text', placeholder: 'City', autocomplete: 'off', 'aria-label': label + ' city' });
    var flag = el('span', { class: 'row-flag', text: T.flag(f[codeKey]) });
    code.value = f[codeKey] || ''; city.value = f[cityKey] || '';
    var auto = !f[cityKey] || D.AIRPORTS[f[codeKey]] === f[cityKey];
    var row = el('div', { class: 'row' }, [el('span', { text: label }), code, city, flag]);
    code.addEventListener('input', function () {
      f[codeKey] = code.value.toUpperCase().replace(/[^A-Z]/g, '');
      flag.textContent = T.flag(f[codeKey]);
      if (auto || !city.value) {
        var known = D.AIRPORTS[f[codeKey]];
        if (known || auto) { city.value = known || ''; f[cityKey] = city.value; auto = true; }
      }
      mark(row, f, codeKey);
    });
    city.addEventListener('input', function () { f[cityKey] = city.value; auto = false; });
    mark(row, f, codeKey);
    return row;
  }
  function routeHint(f, idx) {
    var r = f._route;
    if (!r || !r.from || !r.to) return null;
    if (r.from === f.from && r.to === f.to) return el('div', { class: 'hint ok', text: '✓ ' + f.flightNumber + ' normally flies ' + r.from + ' → ' + r.to + ', matching this ticket.' });
    return el('div', { class: 'hint warn' }, [
      el('span', { text: f.flightNumber + ' normally flies ' + r.from + ' → ' + r.to + ', but this was read as ' + (f.from || '?') + ' → ' + (f.to || '?') + '.' }),
      el('button', { text: 'Use ' + r.from + ' → ' + r.to, onclick: function () {
        f.from = r.from; f.fromCity = D.AIRPORTS[r.from] || ''; f.to = r.to; f.toCity = D.AIRPORTS[r.to] || '';
        renderFlights();
      } })
    ]);
  }
  function flightGroup(f, idx) {
    var wrap = el('div', { 'data-flight': idx });
    var title = el('h3', { class: 'group-title' }, [el('span', { text: form.flights.length > 1 ? 'Flight ' + (idx + 1) : 'Flight' })]);
    if (form.mode === 'new' && form.flights.length > 1) {
      title.appendChild(el('button', { text: 'Remove', onclick: function () { form.flights.splice(idx, 1); renderFlights(); } }));
    }
    var dateRow = inputRow('Date', f, 'date', { type: 'date' });
    dateRow.setAttribute('data-date-row', '1');
    wrap.appendChild(title);
    wrap.appendChild(routeHint(f, idx) || document.createTextNode(''));
    wrap.appendChild(el('div', { class: 'group' }, [
      airportRow('From', f, 'from', 'fromCity'),
      airportRow('To', f, 'to', 'toCity'),
      dateRow,
      inputRow('Departs', f, 'depTime', { type: 'time' }),
      inputRow('Arrives', f, 'arrTime', { type: 'time' }),
      inputRow('Airline', f, 'airline', { placeholder: 'e.g. Lufthansa', autocapitalize: 'words' }),
      inputRow('Flight number', f, 'flightNumber', { placeholder: 'e.g. LH 760', class: 'upper', autocapitalize: 'characters' }, function (v) { return v.toUpperCase(); })
    ]));
    return wrap;
  }
  function renderFlights() {
    var box = $('f-flights'); box.textContent = '';
    form.flights.forEach(function (f, i) { box.appendChild(flightGroup(f, i)); });
  }
  function renderPax(focusLast) {
    var box = $('f-pax'); box.textContent = '';
    if (!form.passengers.length) form.passengers.push('');
    form.passengers.forEach(function (name, i) {
      var input = el('input', { type: 'text', placeholder: 'Full name', autocapitalize: 'words', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Traveller ' + (i + 1) });
      input.value = name;
      input.addEventListener('input', function () { form.passengers[i] = input.value; });
      var x = el('button', { class: 'x', 'aria-label': 'Remove traveller', text: '×', onclick: function () { form.passengers.splice(i, 1); renderPax(); } });
      box.appendChild(el('div', { class: 'row' }, [el('span', { text: 'Traveller ' + (i + 1) }), input, x]));
      if (focusLast && i === form.passengers.length - 1) input.focus();
    });
  }
  function openForm(state) {
    form = state;
    $('form-title').textContent = state.title;
    $('form-error').hidden = true;
    var note = $('form-note');
    note.hidden = !state.note; note.textContent = state.note || ''; note.className = 'note' + (state.noteOk ? ' ok' : '');
    $('f-pnr').value = state.pnr || '';
    $('f-add-flight').hidden = state.mode !== 'new';
    $('form-copy-raw').hidden = !(state.rawTexts && state.rawTexts.length);
    renderPax(); renderFlights();

    var shot = $('form-shot'); shot.hidden = true;
    var show = function (u) { if (!u || form !== state) return; form.shotUrl = u; $('form-shot-img').src = u; shot.hidden = false; };
    if (state.image) { form.tempUrl = URL.createObjectURL(new Blob([state.image.data], { type: state.image.type })); show(form.tempUrl); }
    else if (state.imageId) imageUrl(state.imageId).then(show);

    $('view-form').hidden = false;
    $('view-form').querySelector('.view-body').scrollTop = 0;

    // Optional: compare each flight number with the route it normally flies.
    if (state.read && S.getSettings().routeCheck && navigator.onLine !== false) {
      state.flights.forEach(function (f) {
        if (!f.flightNumber) return;
        S.fetchRoute(f.flightNumber).then(function (r) { if (r && form === state) { f._route = r; renderFlights(); } });
      });
    }
  }
  function closeForm() {
    if (form && form.tempUrl) URL.revokeObjectURL(form.tempUrl);
    form = null; $('view-form').hidden = true;
    if (queue.length) setTimeout(nextFile, 350);
  }
  function saveForm() {
    var err = $('form-error'); err.hidden = true;
    var pnr = $('f-pnr').value.trim().toUpperCase();
    var pax = form.passengers.map(function (p) { return p.trim().replace(/\s+/g, ' '); }).filter(Boolean);
    var bad = -1, why = '';
    form.flights.forEach(function (f, i) {
      if (bad !== -1) return;
      if (!f.from && !f.to && !f.flightNumber.trim()) { bad = i; why = 'Please fill in where the flight goes from and to.'; }
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) { bad = i; why = 'Please set the date of the flight' + (form.flights.length > 1 ? ' (flight ' + (i + 1) + ')' : '') + '.'; }
    });
    if (bad !== -1) {
      err.textContent = why; err.hidden = false;
      var g = $('f-flights').children[bad];
      if (g) { var r = g.querySelector('[data-date-row]'); if (r && /date/.test(why)) r.classList.add('missing'); g.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    var now = Date.now(), old = form.mode === 'edit' ? byId(form.id) : null;
    var imageId = form.image ? form.image.id : (form.imageId || '');
    var records = form.flights.map(function (f) {
      var rec = {
        id: old ? old.id : TicketDB.newId(), schema: TicketDB.SCHEMA, imageId: imageId,
        airline: f.airline.trim(), flightNumber: f.flightNumber.trim().toUpperCase(),
        from: f.from.trim().toUpperCase(), fromCity: f.fromCity.trim(),
        to: f.to.trim().toUpperCase(), toCity: f.toCity.trim(),
        date: f.date, depTime: f.depTime || '', arrTime: f.arrTime || '',
        pnr: pnr, passengers: pax, live: null,
        createdAt: form.createdAt || now, updatedAt: now
      };
      // Live status stays valid only while it still describes the same flight on the same day.
      if (old && old.live && old.flightNumber === rec.flightNumber && old.date === rec.date && old.from === rec.from) rec.live = old.live;
      return rec;
    });
    var wasEdit = !!old, editedId = form.id;
    TicketDB.saveTickets(records, form.image || null).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      closeForm();
      if (!wasEdit) tab = '';
      return reload();
    }).then(function () {
      if (wasEdit) openDetail(editedId);
      toast(wasEdit ? 'Saved' : records.length === 1 ? 'Ticket saved' : records.length + ' tickets saved');
      autoCheck();
    }).catch(function (e) {
      console.error(e);
      err.textContent = 'Saving failed. The phone may be out of storage space.'; err.hidden = false;
    });
  }
  function copyRaw() {
    var text = (form.rawTexts || []).join('\n\n-----\n\n');
    var done = function () { toast('Copied. Remove names before sharing it.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast('Copying is not allowed here'); });
    else toast('Copying is not available in this browser');
  }

  // ---------- detail ----------
  function fact(label, value, cls) {
    return el('div', { class: 'fact' + (cls ? ' ' + cls : '') }, [el('small', { text: label }), typeof value === 'string' ? el('div', { text: value || '—' }) : value]);
  }
  function legBlock(title, code, city, date, time, old, zone, plus, extras) {
    var f = T.flag(code);
    return el('div', { class: 'leg' }, [
      el('small', { text: title }),
      el('div', { class: 'leg-place' }, [f ? el('span', { class: 'flag', text: f }) : null, el('strong', { text: code || '—' }), el('span', { text: city ? ' ' + city : '' })]),
      el('div', { class: 'leg-when' }, [
        el('span', { text: (date ? niceDate(date, true) : 'Date unknown') + (time ? ' · ' : '') }),
        old ? el('s', { class: 'old-time', text: old }) : null,
        el('strong', { class: old ? 'new-time' : '', text: time || '' }),
        zone && time ? el('span', { class: 'zone', text: ' ' + zone }) : null,
        plus > 0 ? el('span', { class: 'plus-note', text: plus === 1 ? ' (next day)' : ' (+' + plus + ' days)' }) : null
      ]),
      extras.length ? el('div', { class: 'leg-extra', text: extras.join(' · ') }) : null
    ]);
  }
  function openDetail(id, keepScroll) {
    var t = byId(id);
    if (!t) { closeDetail(); return; }
    currentId = id;
    var v = view(t), live = v.live, body = $('detail-body'), scroll = body.scrollTop;
    body.textContent = '';
    var depX = [], arrX = [];
    if (live) {
      if (live.dep.terminal) depX.push('Terminal ' + live.dep.terminal);
      if (live.dep.desk) depX.push('Check-in ' + live.dep.desk);
      if (live.dep.gate) depX.push('Gate ' + live.dep.gate);
      if (live.arr.terminal) arrX.push('Terminal ' + live.arr.terminal);
      if (live.arr.gate) arrX.push('Gate ' + live.arr.gate);
      if (live.arr.belt) arrX.push('Baggage belt ' + live.arr.belt);
    }
    var card = el('div', { class: 'detail-card' }, [
      el('div', { class: 'detail-date' }, [el('span', { text: niceDate(v.dep.date, true) }), badge(t, v)]),
      routeBlock(t, v),
      v.sum ? el('div', { class: 'status-banner ' + v.sum.tone }, [
        el('strong', { text: v.sum.text || 'Status received' }),
        el('span', { text: checkedText(live.checkedAt) })
      ]) : null,
      legBlock('Departure', t.from, t.fromCity, v.dep.date, v.dep.time, v.oldDep, v.ex.depZone, 0, depX),
      legBlock('Arrival', t.to, t.toCity, v.arr.date, v.arr.time, v.oldArr, v.ex.arrZone, v.ex.dayShift, arrX),
      el('div', { class: 'facts' }, [
        fact('Booking reference', el('div', { class: 'pnr', text: t.pnr || '—' }), 'full'),
        fact('Airline', t.airline), fact('Flight', t.flightNumber),
        v.ex.durMin != null ? fact('Flight time', T.duration(v.ex.durMin)) : null,
        live && live.aircraft ? fact('Aircraft', live.aircraft) : null,
        fact(t.passengers.length === 1 ? 'Traveller' : 'Travellers', el('ul', null, (t.passengers.length ? t.passengers : ['—']).map(function (p) { return el('li', { text: p }); })), 'full')
      ])
    ]);
    body.appendChild(card);

    var refresh = el('button', { class: 'btn primary wide', text: live ? 'Refresh status' : 'Check live status', onclick: function () {
      if (!S.getSettings().apiKey) { openSettings(); toast('Add your free key first'); return; }
      refresh.disabled = true; refresh.textContent = 'Checking…';
      refreshOne(t).then(function () { render(); openDetail(id, true); toast('Status updated'); },
        function (e) { refresh.disabled = false; refresh.textContent = live ? 'Refresh status' : 'Check live status'; toast(e.message); });
    } });
    if (t.flightNumber && phase(t, v) !== 'past') body.appendChild(refresh);

    if (t.imageId) {
      var img = el('img', { alt: 'Original ticket' });
      var btn = el('button', { class: 'shot-full', hidden: 'hidden', 'aria-label': 'Open the original full size', onclick: function () { openViewer(img.src); } },
        [img, el('span', { text: 'Show original full size' })]);
      body.appendChild(btn);
      imageUrl(t.imageId).then(function (u) { if (u) { img.src = u; btn.hidden = false; } });
    } else body.appendChild(el('p', { class: 'muted', text: 'Typed in by hand — no picture attached.' }));
    body.appendChild(el('div', { class: 'detail-actions' }, [
      el('button', { class: 'btn danger', text: 'Remove ticket', onclick: function () { removeTicket(t); } })
    ]));
    body.scrollTop = keepScroll ? scroll : 0;
    $('view-detail').hidden = false;
  }
  function closeDetail() { $('view-detail').hidden = true; currentId = null; }
  function removeTicket(t) {
    var keptImage = null;
    TicketDB.getImage(t.imageId).then(function (rec) { keptImage = rec; return TicketDB.deleteTicket(t.id); })
      .then(function () { if (currentId === t.id) closeDetail(); return reload(); })
      .then(function () {
        toast('Ticket removed', function () {
          TicketDB.saveTickets([t], keptImage).then(reload).then(function () { toast('Ticket restored'); });
        });
      }).catch(function (e) { console.error(e); toast('Could not remove the ticket'); });
  }
  function editCurrent() {
    var t = byId(currentId);
    if (!t) return;
    openForm({
      mode: 'edit', title: 'Edit ticket', id: t.id, imageId: t.imageId, createdAt: t.createdAt,
      pnr: t.pnr, passengers: t.passengers.slice(),
      flights: [{ airline: t.airline, flightNumber: t.flightNumber, from: t.from, fromCity: t.fromCity, to: t.to, toCity: t.toCity, date: t.date, depTime: t.depTime, arrTime: t.arrTime }]
    });
  }

  // ---------- settings ----------
  function keyState() {
    var st = S.getSettings();
    $('s-key-state').textContent = st.apiKey ? 'Key saved on this phone. Live status is on.' : 'No key yet. Live status is off and the app contacts no other server.';
  }
  function openSettings() {
    var st = S.getSettings();
    $('s-key').value = st.apiKey; $('s-auto').checked = st.autoCheck; $('s-route').checked = st.routeCheck;
    keyState();
    $('s-about').textContent = 'My Flights ' + APP_VERSION + ' · free and open source · ' + tickets.length + (tickets.length === 1 ? ' ticket' : ' tickets') + ' on this device';
    $('view-settings').hidden = false;
  }
  function storeSettings() {
    S.saveSettings({ apiKey: $('s-key').value.trim(), autoCheck: $('s-auto').checked, routeCheck: $('s-route').checked });
    autoBlocked = false; keyState();
  }
  function exportBackup() {
    TicketDB.exportAll().then(function (data) {
      var name = 'my-flights-backup-' + todayIso() + '.json';
      var file = new File([JSON.stringify(data)], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: 'My Flights backup' }).catch(function () { /* cancelled */ });
      }
      var u = URL.createObjectURL(file), a = el('a', { href: u, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      toast('Backup saved: ' + data.tickets.length + ' tickets');
    }).catch(function (e) { console.error(e); toast('Backup failed'); });
  }
  function importBackup(file) {
    if (!file) return;
    file.text().then(function (txt) { return TicketDB.importAll(JSON.parse(txt)); })
      .then(function (n) { return reload().then(function () { toast('Restored ' + n + (n === 1 ? ' ticket' : ' tickets')); openSettings(); }); })
      .catch(function (e) { console.error(e); toast(e && /backup/.test(e.message) ? e.message : 'That file could not be read as a backup'); });
  }

  // ---------- original viewer ----------
  function openViewer(src) {
    if (!src) return;
    $('viewer-img').src = src;
    $('viewer-scroll').classList.remove('zoom'); $('viewer-scroll').scrollTop = 0;
    $('viewer').hidden = false;
  }
  function toggleZoom(ev) {
    var sc = $('viewer-scroll'), img = $('viewer-img');
    var fx = (ev.offsetX || 0) / (img.clientWidth || 1), fy = (ev.offsetY || 0) / (img.clientHeight || 1);
    sc.classList.toggle('zoom');
    if (sc.classList.contains('zoom')) {
      sc.scrollLeft = img.clientWidth * fx - sc.clientWidth / 2;
      sc.scrollTop = img.clientHeight * fy - sc.clientHeight / 2;
    }
  }

  // ---------- wiring ----------
  $('btn-add').addEventListener('click', openAddSheet);
  $('btn-add-empty').addEventListener('click', openAddSheet);
  $('pick-cancel').addEventListener('click', closeAddSheet);
  $('add-sheet').addEventListener('click', function (e) { if (e.target === $('add-sheet')) closeAddSheet(); });
  $('pick-screenshot').addEventListener('click', function () { closeAddSheet(); $('file-input').value = ''; $('file-input').click(); });
  $('pick-manual').addEventListener('click', function () {
    closeAddSheet();
    openForm({ mode: 'new', title: 'New ticket', pnr: '', passengers: [''], flights: [emptyFlight()] });
  });
  $('file-input').addEventListener('change', function () { if (this.files && this.files.length) addFiles(this.files); });
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) { tab = b.getAttribute('data-tab'); render(); window.scrollTo(0, 0); }
  });
  $('btn-refresh').addEventListener('click', refreshAll);
  $('btn-settings').addEventListener('click', openSettings);
  $('settings-done').addEventListener('click', function () { storeSettings(); $('view-settings').hidden = true; render(); autoCheck(); });
  ['s-key', 's-auto', 's-route'].forEach(function (id) { $(id).addEventListener('change', storeSettings); });
  $('s-paste').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Tap the field below and paste there'); $('s-key').focus(); return; }
    navigator.clipboard.readText().then(function (txt) {
      txt = (txt || '').trim();
      if (!/^[A-Za-z0-9]{30,80}$/.test(txt)) { toast('The clipboard does not hold a key yet'); return; }
      $('s-key').value = txt; storeSettings(); toast('Key pasted. Tap step 3 to test it.');
    }, function () { toast('Tap the field below and paste there'); $('s-key').focus(); });
  });
  $('s-test').addEventListener('click', function () {
    storeSettings();
    var b = $('s-test'); b.disabled = true;
    S.testKey().then(function (msg) { $('s-key-state').textContent = msg + ' Live status is on.'; toast(msg); },
      function (e) { $('s-key-state').textContent = e.message; toast(e.message); })
      .then(function () { b.disabled = false; });
  });
  $('s-export').addEventListener('click', exportBackup);
  $('s-import').addEventListener('click', function () { $('import-input').value = ''; $('import-input').click(); });
  $('import-input').addEventListener('change', function () { importBackup(this.files && this.files[0]); });

  $('form-cancel').addEventListener('click', closeForm);
  $('form-save').addEventListener('click', saveForm);
  $('form-save2').addEventListener('click', saveForm);
  $('form-copy-raw').addEventListener('click', copyRaw);
  $('f-add-pax').addEventListener('click', function () { form.passengers.push(''); renderPax(true); });
  $('f-add-flight').addEventListener('click', function () {
    form.flights.push(emptyFlight()); renderFlights();
    $('f-flights').lastChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('form-shot').addEventListener('click', function () { openViewer(form && form.shotUrl); });
  $('detail-back').addEventListener('click', closeDetail);
  $('detail-edit').addEventListener('click', editCurrent);
  $('viewer-close').addEventListener('click', function () { $('viewer').hidden = true; });
  $('viewer-img').addEventListener('click', toggleZoom);

  // Keep countdowns fresh, and check status hourly while the app is open.
  setInterval(function () { if (!document.hidden && $('view-form').hidden) { plainRender(); } }, 60 * 1000);
  setInterval(autoCheck, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { render(); autoCheck(); } });

  // Updates: a new version waits until "Update" is tapped. Tickets are stored separately and are not touched.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        var offer = function () { if (reg.waiting && navigator.serviceWorker.controller) $('update-bar').hidden = false; };
        offer();
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') offer(); });
        });
        $('update-now').addEventListener('click', function () { if (reg.waiting) reg.waiting.postMessage('update-now'); });
      }).catch(function (e) { console.warn('Offline setup failed', e); });
      var reloaded = false, had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (had && !reloaded) { reloaded = true; location.reload(); } });
    });
  }

  reload().then(autoCheck).catch(function (e) {
    console.error(e);
    $('empty').hidden = false;
    toast('Storage is not available in this browser mode');
  });

  // Hooks for the automated browser test (feed files in without the file dialog).
  window.__addScreenshot = function (f) { addFiles([f]); };
  window.__addFiles = addFiles;
})();
