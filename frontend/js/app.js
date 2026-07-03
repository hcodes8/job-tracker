(function () {
  'use strict';

  var palette = ['#4f7cff','#a78bfa','#34d399','#fbbf24','#f87171','#38bdf8','#fb923c','#e879f9'];
  var colorMap = {};
  var colorIdx = 0;
  var STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];

  var storage = window.AppliStorage;
  var isDemo = storage.isDemoMode;

  // module state
  var currentApps = [];
  var selected = new Set();

  function companyColor(name) {
    if (!colorMap[name]) colorMap[name] = palette[colorIdx++ % palette.length];
    return colorMap[name];
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
    catch { return iso; }
  }

  function urlHost(u) {
    try { return new URL(u).hostname.replace('www.', ''); } catch { return u.slice(0, 20); }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function nowLocal() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function toast(msg, type) {
    type = type || 'info';
    var icons = { success:'✓', error:'✕', info:'ℹ' };
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span>' + icons[type] + '</span><span>' + esc(msg) + '</span>';
    document.getElementById('toastWrap').appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  function updateBulkBar() {
    var bar = document.getElementById('bulkBar');
    document.getElementById('bulkCount').textContent = selected.size + ' selected';
    bar.classList.toggle('visible', selected.size > 0);
  }

  function clearSelection() {
    selected.clear();
    document.querySelectorAll('.row-cb').forEach(function (cb) { cb.checked = false; });
    document.getElementById('selAll').checked = false;
    document.querySelectorAll('#tbody tr').forEach(function (tr) { tr.classList.remove('sel'); });
    updateBulkBar();
  }

  function normStatus(s) {
    return STATUSES.indexOf(s) !== -1 ? s : 'Applied';
  }

  function applyFilters(apps) {
    var q = document.getElementById('filterCompany').value.trim().toLowerCase();
    var st = document.getElementById('filterStatus').value;
    return apps.filter(function (a) {
      if (st && normStatus(a.status) !== st) return false;
      if (q) {
        var hay = (String(a.company || '') + ' ' + String(a.job_title || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderTable(apps) {
    var tbody = document.getElementById('tbody');
    var table = document.getElementById('mainTable');
    var empty = document.getElementById('emptyState');
    var totalCount = currentApps.length;

    if (!apps || apps.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      var emptyTitle = empty.querySelector('h3');
      var emptyMsg = empty.querySelector('p');
      if (totalCount === 0) {
        if (emptyTitle) emptyTitle.textContent = 'No applications yet';
        if (emptyMsg) emptyMsg.textContent = 'Start tracking your job search.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No matches';
        if (emptyMsg) emptyMsg.textContent = 'Try adjusting your filters.';
      }
      document.getElementById('badge').textContent =
        totalCount + ' application' + (totalCount !== 1 ? 's' : '');
      return;
    }

    empty.style.display = 'none';
    table.style.display = 'table';
    var badge = apps.length === totalCount
      ? totalCount + ' application' + (totalCount !== 1 ? 's' : '')
      : apps.length + ' of ' + totalCount;
    document.getElementById('badge').textContent = badge;

    var rows = '';
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      var color = companyColor(app.company);
      var dateStr = fmtDate(app.date_applied);
      var hasResume = app.has_resume == 1 || app.has_resume === true;
      var resumeName = app.resume_original_name || 'resume.pdf';
      var status = normStatus(app.status);

      rows += '<tr id="row-' + app.id + '">';
      rows += '<td><input type="checkbox" class="row-cb" data-id="' + app.id + '" /></td>';
      rows += '<td class="cell-date">' + dateStr + '</td>';
      rows += '<td class="cell-title" title="' + esc(app.job_title) + '">' + esc(app.job_title) + '</td>';
      rows += '<td><div class="company-chip" title="' + esc(app.company) + '"><span class="dot" style="background:' + color + '"></span>' + esc(app.company) + '</div></td>';
      rows += '<td><span class="status-pill-wrap status-' + status + '">';
      rows += '<select class="status-pill status-' + status + '" data-id="' + app.id + '" title="Click to change status">';
      for (var s = 0; s < STATUSES.length; s++) {
        var sel = STATUSES[s] === status ? ' selected' : '';
        rows += '<option value="' + STATUSES[s] + '"' + sel + '>' + STATUSES[s] + '</option>';
      }
      rows += '</select></span></td>';
      var desc = app.job_description || '';
      rows += '<td class="cell-desc" title="Click to expand" data-desc="' + esc(desc) + '">' + esc(desc || '—') + '</td>';
      if (app.url) {
        rows += '<td><a class="url-link" href="' + esc(app.url) + '" target="_blank" rel="noopener" title="' + esc(app.url) + '">';
        rows += '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        rows += esc(urlHost(app.url)) + '</a></td>';
      } else {
        rows += '<td><span style="color:var(--text3)">—</span></td>';
      }
      if (hasResume) {
        rows += '<td><button class="resume-btn" data-id="' + app.id + '" data-name="' + esc(resumeName) + '">';
        rows += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        rows += esc(resumeName.slice(0, 14)) + '</button></td>';
      } else {
        rows += '<td><span class="no-resume">No resume</span></td>';
      }
      rows += '</tr>';
    }
    tbody.innerHTML = rows;

    tbody.querySelectorAll('.row-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = parseInt(this.dataset.id, 10);
        if (this.checked) selected.add(id); else selected.delete(id);
        var row = document.getElementById('row-' + id);
        if (row) row.classList.toggle('sel', this.checked);
        updateBulkBar();
      });
    });

    tbody.querySelectorAll('.resume-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPdf(this.dataset.id, this.dataset.name);
      });
    });

    tbody.querySelectorAll('.cell-desc').forEach(function (td) {
      td.addEventListener('click', function () {
        var text = this.dataset.desc;
        if (text) openDesc(text);
      });
    });

    tbody.querySelectorAll('.status-pill').forEach(function (sel) {
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
      sel.addEventListener('change', function () {
        var id = parseInt(this.dataset.id, 10);
        var newStatus = this.value;
        var prev = this.dataset.prev || null;
        var selectEl = this;
        selectEl.disabled = true;
        storage.updateStatus(id, newStatus)
          .then(function () {
            for (var i = 0; i < currentApps.length; i++) {
              if (currentApps[i].id === id) { currentApps[i].status = newStatus; break; }
            }
            var wrap = selectEl.parentElement;
            STATUSES.forEach(function (s) {
              selectEl.classList.remove('status-' + s);
              wrap.classList.remove('status-' + s);
            });
            selectEl.classList.add('status-' + newStatus);
            wrap.classList.add('status-' + newStatus);
            selectEl.dataset.prev = newStatus;
            var filterStatus = document.getElementById('filterStatus').value;
            if (filterStatus && filterStatus !== newStatus) rerender();
          })
          .catch(function (err) {
            toast('Status update failed: ' + err.message, 'error');
            if (prev) selectEl.value = prev;
          })
          .finally(function () { selectEl.disabled = false; });
      });
      sel.dataset.prev = sel.value;
    });
  }

  function rerender() {
    renderTable(applyFilters(currentApps));
  }

  function loadApplications() {
    var sort = document.getElementById('sortSelect').value;
    document.getElementById('loadingTxt').style.display = 'inline';
    clearSelection();

    storage.list(sort)
      .then(function (apps) {
        currentApps = apps || [];
        rerender();
      })
      .catch(function (err) {
        console.error('[LOAD ERROR]', err);
        toast('Load failed: ' + err.message, 'error');
      })
      .finally(function () {
        document.getElementById('loadingTxt').style.display = 'none';
      });
  }

  function submitApplication() {
    var title = document.getElementById('f_title').value.trim();
    var company = document.getElementById('f_company').value.trim();
    if (!title || !company) { toast('Job Title and Company are required', 'error'); return; }

    var btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    var fd = new FormData();
    fd.append('job_title', title);
    fd.append('company', company);
    fd.append('status', document.getElementById('f_status').value);
    fd.append('job_description', document.getElementById('f_desc').value.trim());
    fd.append('url', document.getElementById('f_url').value.trim());
    var dv = document.getElementById('f_date').value;
    fd.append('date_applied', dv ? new Date(dv).toISOString() : new Date().toISOString());
    if (!isDemo) {
      var rf = document.getElementById('f_resume').files[0];
      if (rf) fd.append('resume', rf);
    }

    storage.create(fd)
      .then(function () {
        toast('Application added!', 'success');
        closeAddModal();
        loadApplications();
      })
      .catch(function (err) {
        console.error('[INSERT ERROR]', err);
        toast('Error: ' + err.message, 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Add Application';
      });
  }

  function deleteSelected() {
    if (!selected.size) return;
    var ids = Array.from(selected);
    if (!confirm('Delete ' + ids.length + ' application(s)? This cannot be undone.')) return;

    storage.deleteBatch(ids)
      .then(function () {
        toast('Deleted ' + ids.length + ' application(s)', 'success');
        clearSelection();
        loadApplications();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  }

  function openPdf(id, name) {
    var url = storage.getResumeUrl(id);
    if (!url) { toast('Resume preview not available in demo mode', 'info'); return; }
    document.getElementById('pdfTitle').textContent = name;
    document.getElementById('pdfFrame').src = url;
    document.getElementById('pdfDownload').href = url;
    document.getElementById('pdfDownload').download = name;
    document.getElementById('pdfOverlay').classList.add('open');
  }

  function closePdf() {
    document.getElementById('pdfOverlay').classList.remove('open');
    document.getElementById('pdfFrame').src = '';
  }

  function openDesc(text) {
    document.getElementById('descText').textContent = text;
    document.getElementById('descOverlay').classList.add('open');
  }

  function closeDesc() {
    document.getElementById('descOverlay').classList.remove('open');
  }

  function openAddModal() {
    document.getElementById('f_title').value = '';
    document.getElementById('f_company').value = '';
    document.getElementById('f_status').value = 'Applied';
    document.getElementById('f_date').value = nowLocal();
    document.getElementById('f_url').value = '';
    document.getElementById('f_desc').value = '';
    if (!isDemo) {
      document.getElementById('f_resume').value = '';
      document.getElementById('fileChosen').style.display = 'none';
    }
    document.getElementById('addOverlay').classList.add('open');
    setTimeout(function () { document.getElementById('f_title').focus(); }, 80);
  }

  function closeAddModal() {
    document.getElementById('addOverlay').classList.remove('open');
  }

  // CSV export — exports currently-visible (filtered) rows
  function csvEscape(v) {
    if (v == null) return '';
    var s = String(v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    var rows = applyFilters(currentApps);
    if (rows.length === 0) { toast('Nothing to export', 'info'); return; }

    var headers = ['id', 'date_applied', 'job_title', 'company', 'status', 'url', 'job_description'];
    var lines = [headers.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push([
        csvEscape(r.id),
        csvEscape(r.date_applied),
        csvEscape(r.job_title),
        csvEscape(r.company),
        csvEscape(normStatus(r.status)),
        csvEscape(r.url),
        csvEscape(r.job_description)
      ].join(','));
    }
    var csv = lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'appli-export-' + stamp + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Exported ' + rows.length + ' row(s)', 'success');
  }

  // Demo-mode UI tweaks
  if (isDemo) {
    document.getElementById('demoBanner').style.display = 'flex';
    document.getElementById('resumeField').style.display = 'none';
    document.getElementById('resumeFieldDemo').style.display = 'flex';
  }

  // Wire up
  document.getElementById('addBtn').addEventListener('click', openAddModal);
  document.getElementById('addBtn2').addEventListener('click', openAddModal);
  document.getElementById('closeAdd').addEventListener('click', closeAddModal);
  document.getElementById('cancelAdd').addEventListener('click', closeAddModal);
  document.getElementById('submitBtn').addEventListener('click', submitApplication);
  document.getElementById('closePdf').addEventListener('click', closePdf);
  document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
  document.getElementById('cancelSelBtn').addEventListener('click', clearSelection);
  document.getElementById('closeDesc').addEventListener('click', closeDesc);
  document.getElementById('descOverlay').addEventListener('click', function (e) { if (e.target === this) closeDesc(); });

  document.getElementById('addOverlay').addEventListener('click', function (e) { if (e.target === this) closeAddModal(); });
  document.getElementById('pdfOverlay').addEventListener('click', function (e) { if (e.target === this) closePdf(); });

  document.getElementById('sortSelect').addEventListener('change', loadApplications);
  document.getElementById('filterCompany').addEventListener('input', rerender);
  document.getElementById('filterStatus').addEventListener('change', rerender);
  document.getElementById('exportBtn').addEventListener('click', exportCsv);

  document.getElementById('selAll').addEventListener('change', function () {
    var checked = this.checked;
    document.querySelectorAll('.row-cb').forEach(function (cb) {
      cb.checked = checked;
      var id = parseInt(cb.dataset.id, 10);
      if (checked) selected.add(id); else selected.delete(id);
      var row = document.getElementById('row-' + id);
      if (row) row.classList.toggle('sel', checked);
    });
    updateBulkBar();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAddModal(); closePdf(); closeDesc(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openAddModal(); }
  });

  // File pick (server mode only)
  if (!isDemo) {
    document.getElementById('f_resume').addEventListener('change', function () {
      var f = this.files[0];
      if (f) {
        document.getElementById('fileName').textContent = f.name;
        document.getElementById('fileChosen').style.display = 'flex';
      }
    });

    var fileDrop = document.getElementById('fileDrop');
    fileDrop.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('over'); });
    fileDrop.addEventListener('dragleave', function () { this.classList.remove('over'); });
    fileDrop.addEventListener('drop', function (e) {
      e.preventDefault(); this.classList.remove('over');
      var f = e.dataTransfer.files[0];
      if (f && f.type === 'application/pdf') {
        document.getElementById('f_resume').files = e.dataTransfer.files;
        document.getElementById('fileName').textContent = f.name;
        document.getElementById('fileChosen').style.display = 'flex';
      } else { toast('Please drop a PDF file', 'error'); }
    });
  }

  loadApplications();
}());
