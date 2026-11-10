/* My Flights — screen logic. Everything stays on this device. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = FlightData;

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

  // ---------- dates ----------
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function parseIso(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function niceDate(iso, long) {
    if (!iso) return 'Date missing';
    var d = parseIso(iso), sameYear = d.getFullYear() === new Date().getFullYear();
    var opt = long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
                   : { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' };
    return d.toLocaleDateString(undefined, opt);
  }
  function daysAway(iso) { return Math.round((parseIso(iso) - parseIso(todayIso())) / 864e5); }
  function badgeFor(iso) {
    if (!iso) return null;
    var n = daysAway(iso);
    if (n === 0) return el('span', { class: 'badge today', text: 'Today' });
    if (n === 1) return el('span', { class: 'badge', text: 'Tomorrow' });
    if (n > 1) return el('span', { class: 'badge', text: 'in ' + n + ' days' });
    return el('span', { class: 'badge past', text: n === -1 ? 'Yesterday' : -n + ' days ago' });
  }
  function sortKey(t) { return (t.date || '9999-12-31') + 'T' + (t.depTime || '00:00'); }

  // ---------- state ----------
  var tickets = [];
  var imageUrls = {};        // imageId -> object URL (made on demand)
  var form = null;           // what the form is editing
  var currentId = null;      // ticket shown in the detail view

  function toast(msg, undo) {
    var t = $('toast'), u = $('toast-undo');
    $('toast-text').textContent = msg;
    u.hidden = !undo;
    u.onclick = undo ? function () { t.hidden = true; undo(); } : null;
    t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, undo ? 6000 : 2200);
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

  // ---------- home ----------
  function routeBlock(t) {
    return el('div', { class: 'route' }, [
      el('div', { class: 'end' }, [
        el('div', { class: 'code', text: t.from || '—' }),
        el('div', { class: 'city', text: t.fromCity || '' }),
        el('div', { class: 'time', text: t.depTime || '' })
      ]),
      el('div', { class: 'mid' }, [svg(PLANE)]),
      el('div', { class: 'end right' }, [
        el('div', { class: 'code', text: t.to || '—' }),
        el('div', { class: 'city', text: t.toCity || '' }),
        el('div', { class: 'time', text: t.arrTime || '' })
      ])
    ]);
  }
  function tile(t) {
    var flight = [t.airline, t.flightNumber].filter(Boolean).join(' · ');
    var pax = t.passengers && t.passengers.length;
    var label = [t.from, t.to].filter(Boolean).join(' to ') || t.flightNumber || 'ticket';
    var x = el('button', { class: 'tile-x', 'aria-label': 'Remove ' + label, onclick: function (e) { e.stopPropagation(); removeTicket(t); } }, [svg('M6 6l12 12M18 6L6 18')]);
    return el('div', { class: 'tile', role: 'button', tabindex: '0', 'aria-label': 'Open ' + label,
      onclick: function () { openDetail(t.id); },
      onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(t.id); } } }, [
      el('div', { class: 'tile-top' }, [el('span', { class: 'when', text: niceDate(t.date) }), el('span', { class: 'tile-top-right' }, [badgeFor(t.date), x])]),
      routeBlock(t),
      el('div', { class: 'tile-meta' }, [
        el('span', { class: 'flight', text: flight || 'Flight' }),
        t.pnr ? el('span', { class: 'pnr' }, [el('small', { text: 'Ref' }), t.pnr]) : null
      ]),
      el('div', { class: 'pax' + (pax ? '' : ' none') }, [svg(PERSON), el('span', { text: pax ? t.passengers.join(', ') : 'No travellers added' })])
    ]);
  }
  function render() {
    var today = todayIso();
    var up = tickets.filter(function (t) { return !t.date || t.date >= today; })
      .sort(function (a, b) { return sortKey(a) < sortKey(b) ? -1 : 1; });
    var past = tickets.filter(function (t) { return t.date && t.date < today; })
      .sort(function (a, b) { return sortKey(a) > sortKey(b) ? -1 : 1; });
    var fill = function (boxId, list) { var b = $(boxId); b.textContent = ''; list.forEach(function (t) { b.appendChild(tile(t)); }); };
    fill('list-upcoming', up); fill('list-past', past);
    $('count-upcoming').textContent = up.length ? '· ' + up.length : '';
    $('count-past').textContent = past.length ? '· ' + past.length : '';
    $('sec-upcoming').hidden = !up.length;
    $('sec-past').hidden = !past.length;
    $('empty').hidden = tickets.length > 0;
    $('footnote').hidden = tickets.length === 0;
  }
  function reload() {
    return TicketDB.allTickets().then(function (all) { tickets = all; render(); });
  }

  // ---------- add ----------
  function openAddSheet() { $('add-sheet').hidden = false; }
  function closeAddSheet() { $('add-sheet').hidden = true; }

  function setBusy(frac, text) {
    $('busy').hidden = false;
    if (text) $('busy-text').textContent = text;
    $('busy-bar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  }
  function emptyFlight() {
    return { airline: '', flightNumber: '', from: '', fromCity: '', to: '', toCity: '', date: '', depTime: '', arrTime: '' };
  }

  var queue = [];          // files still waiting to be read (when several were picked at once)
  function addFiles(list) {
    for (var i = 0; i < list.length; i++) queue.push(list[i]);
    nextFile();
  }
  function nextFile() {
    if (form || !$('busy').hidden || !queue.length) return;
    handleFile(queue.shift());
  }

  function handleFile(file) {
    if (!file) return;
    var pdf = TicketOCR.isPdf(file), what = pdf ? 'PDF' : 'screenshot';
    setBusy(0.02, pdf ? 'Opening PDF…' : 'Getting the reader ready…');
    var parsed = null, problem = '', result = null;
    TicketOCR.readFile(file, setBusy).then(function (r) {
      result = r;
      parsed = TicketParser.parseBest(r.texts);
    }).catch(function (e) {
      console.error(e);
      problem = (pdf && e && e.message) ? e.message
        : 'The ' + what + ' could not be read automatically. You can still type the details in — the picture will be kept with the ticket.';
    }).then(function () {
      var keep = result ? result.imageBlob : (pdf ? null : file);   // a PDF that failed to open has no picture to keep
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
            '. Please check each field before saving.';
          if (result.pages > result.pagesRead) note += ' Only the first ' + result.pagesRead + ' of ' + result.pages + ' pages were read.';
        }
      }
      if (queue.length) note += ' (' + queue.length + ' more to go after this one.)';
      openForm({
        mode: 'new', title: 'Check details', note: note, noteOk: ok, image: image,
        pnr: parsed.pnr, passengers: parsed.passengers.slice(),
        flights: parsed.flights.length ? parsed.flights : [emptyFlight()]
      });
    }).catch(function (e) {
      console.error(e);
      $('busy').hidden = true;
      toast('Could not open that file');
      setTimeout(nextFile, 400);
    });
  }

  // ---------- form ----------
  function inputRow(label, value, attrs, onInput) {
    var i = el('input', Object.assign({ type: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' }, attrs || {}));
    i.value = value || '';
    i.addEventListener('input', function () { onInput(i.value, i); });
    return el('label', { class: 'row' }, [el('span', { text: label }), i]);
  }
  function airportRow(label, f, codeKey, cityKey) {
    var code = el('input', { type: 'text', class: 'code', maxlength: '3', placeholder: 'FRA', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': label + ' airport code' });
    var city = el('input', { type: 'text', placeholder: 'City', autocomplete: 'off', 'aria-label': label + ' city' });
    code.value = f[codeKey] || ''; city.value = f[cityKey] || '';
    var auto = !f[cityKey] || D.AIRPORTS[f[codeKey]] === f[cityKey];
    code.addEventListener('input', function () {
      f[codeKey] = code.value.toUpperCase().replace(/[^A-Z]/g, '');
      if (auto || !city.value) {
        var known = D.AIRPORTS[f[codeKey]];
        if (known || auto) { city.value = known || ''; f[cityKey] = city.value; auto = true; }
      }
    });
    city.addEventListener('input', function () { f[cityKey] = city.value; auto = false; });
    return el('div', { class: 'row' }, [el('span', { text: label }), code, city]);
  }
  function flightGroup(f, idx) {
    var wrap = el('div', { 'data-flight': idx });
    var title = el('h3', { class: 'group-title' }, [el('span', { text: form.flights.length > 1 ? 'Flight ' + (idx + 1) : 'Flight' })]);
    if (form.mode === 'new' && form.flights.length > 1) {
      title.appendChild(el('button', { text: 'Remove', onclick: function () { form.flights.splice(idx, 1); renderFlights(); } }));
    }
    var dateRow = inputRow('Date', f.date, { type: 'date' }, function (v) { f.date = v; dateRow.classList.remove('missing'); });
    dateRow.setAttribute('data-date-row', '1');
    wrap.appendChild(title);
    wrap.appendChild(el('div', { class: 'group' }, [
      airportRow('From', f, 'from', 'fromCity'),
      airportRow('To', f, 'to', 'toCity'),
      dateRow,
      inputRow('Departs', f.depTime, { type: 'time' }, function (v) { f.depTime = v; }),
      inputRow('Arrives', f.arrTime, { type: 'time' }, function (v) { f.arrTime = v; }),
      inputRow('Airline', f.airline, { placeholder: 'e.g. Lufthansa', autocapitalize: 'words' }, function (v) { f.airline = v; }),
      inputRow('Flight number', f.flightNumber, { placeholder: 'e.g. LH 760', class: 'upper', autocapitalize: 'characters' }, function (v) { f.flightNumber = v.toUpperCase(); })
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
    renderPax(); renderFlights();

    var shot = $('form-shot'); shot.hidden = true;
    var show = function (u) { if (!u) return; form.shotUrl = u; $('form-shot-img').src = u; shot.hidden = false; };
    if (state.image) {
      form.tempUrl = URL.createObjectURL(new Blob([state.image.data], { type: state.image.type }));
      show(form.tempUrl);
    } else if (state.imageId) imageUrl(state.imageId).then(show);

    $('view-form').hidden = false;
    $('view-form').querySelector('.view-body').scrollTop = 0;
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
    var now = Date.now();
    var imageId = form.image ? form.image.id : (form.imageId || '');
    var records = form.flights.map(function (f) {
      return {
        id: form.mode === 'edit' ? form.id : TicketDB.newId(),
        imageId: imageId,
        airline: f.airline.trim(), flightNumber: f.flightNumber.trim().toUpperCase(),
        from: f.from.trim().toUpperCase(), fromCity: f.fromCity.trim(),
        to: f.to.trim().toUpperCase(), toCity: f.toCity.trim(),
        date: f.date, depTime: f.depTime || '', arrTime: f.arrTime || '',
        pnr: pnr, passengers: pax,
        createdAt: form.createdAt || now, updatedAt: now
      };
    });
    var wasEdit = form.mode === 'edit', editedId = form.id;
    TicketDB.saveTickets(records, form.image || null).then(function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      closeForm();
      return reload();
    }).then(function () {
      if (wasEdit) openDetail(editedId);
      toast(wasEdit ? 'Saved' : records.length === 1 ? 'Ticket saved' : records.length + ' tickets saved');
    }).catch(function (e) {
      console.error(e);
      err.textContent = 'Saving failed. The phone may be out of storage space.'; err.hidden = false;
    });
  }

  // ---------- detail ----------
  function fact(label, value, cls) {
    return el('div', { class: 'fact' + (cls ? ' ' + cls : '') }, [el('small', { text: label }), typeof value === 'string' ? el('div', { text: value || '—' }) : value]);
  }
  function openDetail(id) {
    var t = tickets.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    currentId = id;
    var body = $('detail-body'); body.textContent = '';
    var pnrNode = el('div', { class: 'pnr', text: t.pnr || '—' });
    var paxNode = el('ul', null, (t.passengers.length ? t.passengers : ['—']).map(function (p) { return el('li', { text: p }); }));
    body.appendChild(el('div', { class: 'detail-card' }, [
      el('div', { class: 'detail-date' }, [el('span', { text: niceDate(t.date, true) }), badgeFor(t.date)]),
      routeBlock(t),
      el('div', { class: 'facts' }, [
        fact('Booking reference', pnrNode, 'full'),
        fact('Airline', t.airline), fact('Flight', t.flightNumber),
        fact(t.passengers.length === 1 ? 'Traveller' : 'Travellers', paxNode, 'full')
      ])
    ]));
    if (t.imageId) {
      var img = el('img', { alt: 'Original ticket' });
      var btn = el('button', { class: 'shot-full', hidden: 'hidden', 'aria-label': 'Open the original screenshot full size', onclick: function () { openViewer(img.src); } },
        [img, el('span', { text: 'Show original full size' })]);
      body.appendChild(btn);
      imageUrl(t.imageId).then(function (u) { if (u) { img.src = u; btn.hidden = false; } });
    } else {
      body.appendChild(el('p', { class: 'muted', text: 'Typed in by hand — no screenshot attached.' }));
    }
    body.appendChild(el('div', { class: 'detail-actions' }, [
      el('button', { class: 'btn danger', text: 'Remove ticket', onclick: function () { removeTicket(t); } })
    ]));
    body.scrollTop = 0;
    $('view-detail').hidden = false;
  }
  function closeDetail() { $('view-detail').hidden = true; currentId = null; }
  // Removing is one tap; "Undo" in the message at the bottom brings the ticket (and its picture) back.
  function removeTicket(t) {
    var keptImage = null;
    TicketDB.getImage(t.imageId).then(function (rec) {
      keptImage = rec;
      return TicketDB.deleteTicket(t.id);
    }).then(function () {
      if (currentId === t.id) closeDetail();
      return reload();
    }).then(function () {
      toast('Ticket removed', function () {
        TicketDB.saveTickets([t], keptImage).then(reload).then(function () { toast('Ticket restored'); });
      });
    }).catch(function (e) { console.error(e); toast('Could not remove the ticket'); });
  }
  function editCurrent() {
    var t = tickets.filter(function (x) { return x.id === currentId; })[0];
    if (!t) return;
    openForm({
      mode: 'edit', title: 'Edit ticket', id: t.id, imageId: t.imageId, createdAt: t.createdAt,
      pnr: t.pnr, passengers: t.passengers.slice(),
      flights: [{ airline: t.airline, flightNumber: t.flightNumber, from: t.from, fromCity: t.fromCity, to: t.to, toCity: t.toCity, date: t.date, depTime: t.depTime, arrTime: t.arrTime }]
    });
  }

  // ---------- screenshot viewer ----------
  function openViewer(src) {
    if (!src) return;
    $('viewer-img').src = src;
    $('viewer-scroll').classList.remove('zoom');
    $('viewer-scroll').scrollTop = 0;
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

  $('form-cancel').addEventListener('click', closeForm);
  $('form-save').addEventListener('click', saveForm);
  $('form-save2').addEventListener('click', saveForm);
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

  // Refresh "in 3 days" labels when the app comes back to the front.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Offline setup failed', e); }); });
  }

  reload().catch(function (e) {
    console.error(e);
    $('empty').hidden = false;
    toast('Storage is not available in this browser mode');
  });

  // Small hook so the automated browser test can feed a picture in without the file dialog.
  window.__addScreenshot = function (f) { addFiles([f]); };
  window.__addFiles = addFiles;
})();
