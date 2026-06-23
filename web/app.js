(function () {
    'use strict';

    var data = (window.CERT_DATA) || {
        generatedAt: null,
        windowDays: 0,
        windowStart: null,
        caConfig: '(no data — run scripts\\Get-CAReport.ps1)',
        issued: [],
        failed: []
    };

    var COLUMNS = {
        issued: [
            { key: 'RequestID',     label: 'Request ID', type: 'number' },
            { key: 'Requester',     label: 'Requester' },
            { key: 'CommonName',    label: 'Common Name' },
            { key: 'Template',      label: 'Template' },
            { key: 'SerialNumber',  label: 'Serial Number' },
            { key: 'NotBefore',     label: 'Valid From', type: 'date' },
            { key: 'NotAfter',      label: 'Valid To',   type: 'date' },
            { key: 'Status',        label: 'Status' }
        ],
        failed: [
            { key: 'RequestID',     label: 'Request ID', type: 'number' },
            { key: 'Requester',     label: 'Requester' },
            { key: 'CommonName',    label: 'Common Name' },
            { key: 'Template',      label: 'Template' },
            { key: 'SubmittedWhen', label: 'Submitted',  type: 'date' },
            { key: 'Disposition',   label: 'Disposition' },
            { key: 'Status',        label: 'Status Message' },
            { key: 'StatusCode',    label: 'Status Code' }
        ]
    };

    var state = {
        view: 'issued',
        search: '',
        filters: {},
        sortKey: null,
        sortDir: 1
    };

    /* ---------- helpers ---------- */

    function formatDate(value) {
        if (!value) return '';
        var d = new Date(value);
        if (isNaN(d.getTime())) return value;
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function displayValue(row, col) {
        var v = row[col.key];
        if (v === null || v === undefined) return '';
        if (col.type === 'date') return formatDate(v);
        return String(v);
    }

    function compareValues(a, b, type) {
        if (a === null || a === undefined || a === '') return 1;
        if (b === null || b === undefined || b === '') return -1;
        if (type === 'number') {
            return (parseFloat(a) || 0) - (parseFloat(b) || 0);
        }
        if (type === 'date') {
            return new Date(a).getTime() - new Date(b).getTime();
        }
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    }

    function currentRows() {
        return (state.view === 'issued') ? data.issued : data.failed;
    }

    function currentColumns() {
        return COLUMNS[state.view];
    }

    function applyFilters(rows) {
        var cols = currentColumns();
        var search = state.search.trim().toLowerCase();
        return rows.filter(function (row) {
            for (var i = 0; i < cols.length; i++) {
                var col = cols[i];
                var f = (state.filters[col.key] || '').trim().toLowerCase();
                if (f) {
                    var v = displayValue(row, col).toLowerCase();
                    if (v.indexOf(f) === -1) return false;
                }
            }
            if (search) {
                var hit = false;
                for (var j = 0; j < cols.length; j++) {
                    if (displayValue(row, cols[j]).toLowerCase().indexOf(search) !== -1) {
                        hit = true; break;
                    }
                }
                if (!hit) return false;
            }
            return true;
        });
    }

    function applySort(rows) {
        if (!state.sortKey) return rows;
        var cols = currentColumns();
        var col = null;
        for (var i = 0; i < cols.length; i++) {
            if (cols[i].key === state.sortKey) { col = cols[i]; break; }
        }
        if (!col) return rows;
        var dir = state.sortDir;
        var sorted = rows.slice();
        sorted.sort(function (a, b) {
            return compareValues(a[col.key], b[col.key], col.type) * dir;
        });
        return sorted;
    }

    /* ---------- rendering ---------- */

    function renderHeader() {
        var cols = currentColumns();
        var headerRow = document.getElementById('header-row');
        var filterRow = document.getElementById('filter-row');
        headerRow.innerHTML = '';
        filterRow.innerHTML = '';

        cols.forEach(function (col) {
            var th = document.createElement('th');
            th.textContent = col.label;
            th.dataset.key = col.key;
            if (state.sortKey === col.key) {
                th.classList.add(state.sortDir === 1 ? 'sort-asc' : 'sort-desc');
            }
            th.addEventListener('click', function () {
                if (state.sortKey === col.key) {
                    state.sortDir = -state.sortDir;
                } else {
                    state.sortKey = col.key;
                    state.sortDir = 1;
                }
                render();
            });
            headerRow.appendChild(th);

            var fth = document.createElement('th');
            var input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'filter';
            input.value = state.filters[col.key] || '';
            input.addEventListener('input', function () {
                state.filters[col.key] = input.value;
                render();
            });
            fth.appendChild(input);
            filterRow.appendChild(fth);
        });
    }

    function renderBody() {
        var cols = currentColumns();
        var rows = applySort(applyFilters(currentRows()));
        var tbody = document.getElementById('data-body');
        var frag = document.createDocumentFragment();

        rows.forEach(function (row) {
            var tr = document.createElement('tr');
            cols.forEach(function (col) {
                var td = document.createElement('td');
                td.textContent = displayValue(row, col);
                tr.appendChild(td);
            });
            frag.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(frag);

        document.getElementById('empty-state').hidden = rows.length !== 0;
        document.getElementById('row-status').textContent =
            rows.length + ' of ' + currentRows().length + ' rows';
        // Stash for export
        renderBody._lastFiltered = rows;
        renderBody._lastCols = cols;
    }

    function renderMeta() {
        document.getElementById('meta-ca').textContent = 'CA: ' + (data.caConfig || '—');
        var win = data.windowStart
            ? formatDate(data.windowStart) + '  →  now (' + (data.windowDays || 0) + ' days)'
            : '—';
        document.getElementById('meta-window').textContent = 'Window: ' + win;
        document.getElementById('meta-generated').textContent =
            'Generated: ' + (data.generatedAt ? formatDate(data.generatedAt) : '—');

        document.getElementById('count-issued').textContent = data.issued.length;
        document.getElementById('count-failed').textContent = data.failed.length;
    }

    function renderSummary() {
        document.getElementById('sum-issued').textContent = data.issued.length;
        document.getElementById('sum-failed').textContent = data.failed.length;

        var requesters = {}, templates = {};
        data.issued.forEach(function (r) {
            if (r.Requester) requesters[r.Requester] = (requesters[r.Requester] || 0) + 1;
            if (r.Template)  templates[r.Template]   = (templates[r.Template]   || 0) + 1;
        });
        data.failed.forEach(function (r) {
            if (r.Requester) requesters[r.Requester] = (requesters[r.Requester] || 0) + 1;
        });

        document.getElementById('sum-requesters').textContent = Object.keys(requesters).length;
        document.getElementById('sum-templates').textContent  = Object.keys(templates).length;
        document.getElementById('sum-window').textContent =
            (data.windowDays || 0) + ' days (since ' + (data.windowStart ? formatDate(data.windowStart) : '—') + ')';

        function fillKV(tbodyId, obj, limit) {
            var tbody = document.querySelector('#' + tbodyId + ' tbody');
            tbody.innerHTML = '';
            var entries = Object.keys(obj).map(function (k) { return [k, obj[k]]; });
            entries.sort(function (a, b) { return b[1] - a[1]; });
            if (limit) entries = entries.slice(0, limit);
            if (entries.length === 0) {
                var tr = document.createElement('tr');
                var td = document.createElement('td');
                td.colSpan = 2;
                td.style.color = 'var(--muted)';
                td.style.textAlign = 'center';
                td.textContent = '(none)';
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }
            entries.forEach(function (e) {
                var tr = document.createElement('tr');
                var th = document.createElement('th'); th.textContent = e[0];
                var td = document.createElement('td'); td.textContent = e[1];
                tr.appendChild(th); tr.appendChild(td);
                tbody.appendChild(tr);
            });
        }

        fillKV('sum-by-template', templates);
        fillKV('sum-by-requester', requesters, 15);

        var byMonth = {};
        data.issued.forEach(function (r) {
            if (!r.NotBefore) return;
            var d = new Date(r.NotBefore);
            if (isNaN(d.getTime())) return;
            var key = d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
            byMonth[key] = (byMonth[key] || 0) + 1;
        });
        // Render months chronologically (not by count)
        var monthEntries = Object.keys(byMonth).sort().map(function (k) { return [k, byMonth[k]]; });
        var monthBody = document.querySelector('#sum-by-month tbody');
        monthBody.innerHTML = '';
        if (monthEntries.length === 0) {
            monthBody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--muted)">(none)</td></tr>';
        } else {
            monthEntries.forEach(function (e) {
                var tr = document.createElement('tr');
                var th = document.createElement('th'); th.textContent = e[0];
                var td = document.createElement('td'); td.textContent = e[1];
                tr.appendChild(th); tr.appendChild(td);
                monthBody.appendChild(tr);
            });
        }

        var byFailure = {};
        data.failed.forEach(function (r) {
            var k = r.Status || r.Disposition || '(unspecified)';
            byFailure[k] = (byFailure[k] || 0) + 1;
        });
        fillKV('sum-by-failure', byFailure);
    }

    function render() {
        if (state.view === 'summary') {
            document.getElementById('view-table').hidden = true;
            document.getElementById('view-summary').hidden = false;
            document.getElementById('toolbar').style.display = 'none';
            renderSummary();
            return;
        }
        document.getElementById('view-table').hidden = false;
        document.getElementById('view-summary').hidden = true;
        document.getElementById('toolbar').style.display = '';
        renderHeader();
        renderBody();
    }

    /* ---------- exports ---------- */

    function csvEscape(value) {
        if (value === null || value === undefined) return '';
        var s = String(value);
        if (/[",\r\n]/.test(s)) {
            s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function exportCsv() {
        var cols = renderBody._lastCols || currentColumns();
        var rows = renderBody._lastFiltered || applyFilters(currentRows());

        var lines = [];
        lines.push(cols.map(function (c) { return csvEscape(c.label); }).join(','));
        rows.forEach(function (r) {
            lines.push(cols.map(function (c) { return csvEscape(displayValue(r, c)); }).join(','));
        });
        // UTF-8 BOM so Excel opens it correctly
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var name = 'ca-report-' + state.view + '-' + ts + '.csv';

        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function exportPdf() {
        var prevView = state.view;
        state.view = 'summary';
        render();
        // give the browser a tick to lay out the summary before opening the print dialog
        setTimeout(function () {
            window.print();
            state.view = prevView;
            render();
        }, 50);
    }

    /* ---------- wiring ---------- */

    function bindUi() {
        document.querySelectorAll('.tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                state.view = btn.dataset.view;
                state.sortKey = null;
                state.filters = {};
                document.getElementById('search').value = '';
                state.search = '';
                render();
            });
        });

        document.getElementById('search').addEventListener('input', function (e) {
            state.search = e.target.value;
            render();
        });

        document.getElementById('clear-filters').addEventListener('click', function () {
            state.filters = {};
            state.search = '';
            document.getElementById('search').value = '';
            render();
        });

        document.getElementById('export-csv').addEventListener('click', exportCsv);
        document.getElementById('export-pdf').addEventListener('click', exportPdf);
    }

    renderMeta();
    bindUi();
    render();
})();
