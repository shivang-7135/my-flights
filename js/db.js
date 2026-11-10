/* Storage on the device (IndexedDB). Two tables:
     tickets — one record per flight
     images  — the original screenshots ({ id, type, data:ArrayBuffer }); one screenshot can belong to several flights */
(function (root) {
  'use strict';
  var NAME = 'my-flights', VERSION = 1, dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise(function (resolve, reject) {
        var req = indexedDB.open(NAME, VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('tickets')) db.createObjectStore('tickets', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { dbp = null; reject(req.error); };
      });
    }
    return dbp;
  }
  function run(stores, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(stores, mode), out;
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
        out = fn(tx);
      });
    });
  }
  function reqValue(req) {
    var box = {};
    req.onsuccess = function () { box.value = req.result; };
    return box;
  }
  function newId() {
    return (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  var api = {
    newId: newId,
    allTickets: function () {
      return run(['tickets'], 'readonly', function (tx) { return reqValue(tx.objectStore('tickets').getAll()); })
        .then(function (b) { return b.value || []; });
    },
    // Save several flights and (optionally) their shared screenshot in one go.
    saveTickets: function (tickets, image) {
      return run(['tickets', 'images'], 'readwrite', function (tx) {
        if (image) tx.objectStore('images').put(image);
        tickets.forEach(function (t) { tx.objectStore('tickets').put(t); });
      });
    },
    // Delete a flight; the screenshot goes too once no other flight uses it.
    deleteTicket: function (id) {
      return run(['tickets', 'images'], 'readwrite', function (tx) {
        var ts = tx.objectStore('tickets');
        var get = ts.get(id);
        get.onsuccess = function () {
          var t = get.result;
          ts.delete(id);
          if (!t || !t.imageId) return;
          var all = ts.getAll();
          all.onsuccess = function () {
            var stillUsed = all.result.some(function (o) { return o.id !== id && o.imageId === t.imageId; });
            if (!stillUsed) tx.objectStore('images').delete(t.imageId);
          };
        };
      });
    },
    getImage: function (id) {
      if (!id) return Promise.resolve(null);
      return run(['images'], 'readonly', function (tx) { return reqValue(tx.objectStore('images').get(id)); })
        .then(function (b) { return b.value || null; });
    }
  };
  root.TicketDB = api;
})(self);
