(function () {
  'use strict';

  var KEY = 'appli:applications';
  var NEXT_ID_KEY = 'appli:next_id';
  var SEEDED_KEY = 'appli:seeded';

  var SEED = [];

  function readAll() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeAll(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  function nextId() {
    var n = parseInt(localStorage.getItem(NEXT_ID_KEY) || '1', 10);
    if (isNaN(n) || n < 1) n = 1;
    localStorage.setItem(NEXT_ID_KEY, String(n + 1));
    return n;
  }

  function ensureSeeded() {
    if (localStorage.getItem(SEEDED_KEY) === '1') return;
    if (readAll() !== null) {
      localStorage.setItem(SEEDED_KEY, '1');
      return;
    }
    var seeded = SEED.map(function (s) {
      var d = new Date();
      d.setDate(d.getDate() - s.daysAgo);
      return {
        id: nextId(),
        date_applied: d.toISOString(),
        job_title: s.job_title,
        company: s.company,
        status: s.status,
        url: s.url,
        job_description: s.job_description,
        resume_original_name: null,
        resume_mime_type: null,
        has_resume: false
      };
    });
    writeAll(seeded);
    localStorage.setItem(SEEDED_KEY, '1');
  }

  function sortApps(apps, sort) {
    var copy = apps.slice();
    if (sort === 'oldest') {
      copy.sort(function (a, b) { return new Date(a.date_applied) - new Date(b.date_applied); });
    } else if (sort === 'company') {
      copy.sort(function (a, b) {
        var c = String(a.company || '').localeCompare(String(b.company || ''));
        return c !== 0 ? c : new Date(b.date_applied) - new Date(a.date_applied);
      });
    } else {
      copy.sort(function (a, b) { return new Date(b.date_applied) - new Date(a.date_applied); });
    }
    return copy;
  }

  function formDataToObj(fd) {
    var obj = {};
    fd.forEach(function (v, k) { obj[k] = v; });
    return obj;
  }

  var localBackend = {
    isDemoMode: true,
    list: function (sort) {
      ensureSeeded();
      return Promise.resolve(sortApps(readAll() || [], sort));
    },
    create: function (fd) {
      ensureSeeded();
      var data = formDataToObj(fd);
      var title = (data.job_title || '').trim();
      var company = (data.company || '').trim();
      if (!title || !company) {
        return Promise.reject(new Error('job_title and company are required'));
      }
      var allowed = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];
      var status = allowed.indexOf(data.status) !== -1 ? data.status : 'Applied';
      var app = {
        id: nextId(),
        date_applied: data.date_applied || new Date().toISOString(),
        job_title: title,
        company: company,
        status: status,
        job_description: data.job_description ? String(data.job_description).trim() : null,
        url: data.url ? String(data.url).trim() : null,
        resume_original_name: null,
        resume_mime_type: null,
        has_resume: false
      };
      var all = readAll() || [];
      all.push(app);
      writeAll(all);
      return Promise.resolve({ id: app.id, message: 'Application created' });
    },
    delete: function (id) {
      var all = readAll() || [];
      writeAll(all.filter(function (a) { return a.id !== id; }));
      return Promise.resolve({ message: 'Deleted successfully' });
    },
    updateStatus: function (id, status) {
      var allowed = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];
      if (allowed.indexOf(status) === -1) {
        return Promise.reject(new Error('Invalid status'));
      }
      var all = readAll() || [];
      var found = false;
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) { all[i].status = status; found = true; break; }
      }
      if (!found) return Promise.reject(new Error('Not found'));
      writeAll(all);
      return Promise.resolve({ message: 'Status updated' });
    },
    deleteBatch: function (ids) {
      var set = {};
      ids.forEach(function (i) { set[i] = true; });
      var all = readAll() || [];
      writeAll(all.filter(function (a) { return !set[a.id]; }));
      return Promise.resolve({ message: 'Deleted ' + ids.length + ' application(s)' });
    },
    getResumeUrl: function () { return null; }
  };

  var apiBackend = {
    isDemoMode: false,
    list: function (sort) {
      return fetch('/api/applications?sort=' + encodeURIComponent(sort)).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    },
    create: function (fd) {
      return fetch('/api/applications', { method: 'POST', body: fd }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.detail || d.error || 'Server error');
          return d;
        });
      });
    },
    delete: function (id) {
      return fetch('/api/applications/' + id, { method: 'DELETE' }).then(function (r) {
        if (!r.ok) throw new Error('Delete failed');
        return r.json();
      });
    },
    updateStatus: function (id, status) {
      return fetch('/api/applications/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || 'Update failed');
          return d;
        });
      });
    },
    deleteBatch: function (ids) {
      return fetch('/api/applications/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids })
      }).then(function (r) {
        if (!r.ok) throw new Error('Delete failed');
        return r.json();
      });
    },
    getResumeUrl: function (id) { return '/api/applications/' + id + '/resume'; }
  };

  window.AppliStorage = window.__DEMO__ ? localBackend : apiBackend;
}());
