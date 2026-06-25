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
            { key: 'Requester',     label: 'Requester', filter: 'select' },
            { key: 'CommonName',    label: 'Common Name' },
            { key: 'Template',      label: 'Template', filter: 'select' },
            { key: 'SerialNumber',  label: 'Serial Number' },
            { key: 'NotBefore',     label: 'Valid From', type: 'date' },
            { key: 'NotAfter',      label: 'Valid To',   type: 'date' },
            { key: 'Status',        label: 'Status', filter: 'select' }
        ],
        failed: [
            { key: 'RequestID',     label: 'Request ID', type: 'number' },
            { key: 'Requester',     label: 'Requester', filter: 'select' },
            { key: 'CommonName',    label: 'Common Name' },
            { key: 'Template',      label: 'Template', filter: 'select' },
            { key: 'SubmittedWhen', label: 'Submitted',  type: 'date' },
            { key: 'Disposition',   label: 'Disposition', filter: 'select' },
            { key: 'Status',        label: 'Status Message', filter: 'select' },
            { key: 'StatusCode',    label: 'Status Code' }
        ]
    };

    var state = {
        view: 'issued',
        search: '',
        filters: {},
        sortKey: null,
        sortDir: 1,
        page: 1,
        pageSize: 50
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

    function filterMode(col) {
        if (col.type === 'date') return 'date';
        if (col.filter === 'select') return 'select';
        return 'text';
    }

    // Rows matching every active filter (and the search) EXCEPT the column
    // identified by excludeKey. Used to cascade a dropdown's option list so it
    // only offers values still reachable given the other filters.
    function rowsForFacet(excludeKey) {
        var cols = currentColumns();
        var search = state.search.trim().toLowerCase();
        return currentRows().filter(function (row) {
            for (var i = 0; i < cols.length; i++) {
                if (cols[i].key === excludeKey) continue;
                if (!matchesFilter(row, cols[i])) return false;
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

    // Distinct, sorted, non-empty values of a column, drawn from the supplied
    // rows (defaults to the whole current view).
    function distinctValues(key, rows) {
        var seen = {};
        (rows || currentRows()).forEach(function (r) {
            var v = r[key];
            if (v === null || v === undefined || v === '') return;
            seen[String(v)] = true;
        });
        return Object.keys(seen).sort(function (a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    // Cascaded option list for a select column: values that remain reachable
    // once every other active filter is applied.
    function cascadedValues(key) {
        return distinctValues(key, rowsForFacet(key));
    }

    // Min/max calendar dates (YYYY-MM-DD) present in a date column, for picker hints.
    function dateBounds(key) {
        var min = null, max = null;
        currentRows().forEach(function (r) {
            var v = r[key];
            if (!v) return;
            var t = new Date(v).getTime();
            if (isNaN(t)) return;
            if (min === null || t < min) min = t;
            if (max === null || t > max) max = t;
        });
        var iso = function (t) {
            var d = new Date(t);
            var pad = function (n) { return (n < 10 ? '0' : '') + n; };
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        };
        return { min: min === null ? null : iso(min), max: max === null ? null : iso(max) };
    }

    function matchesFilter(row, col) {
        var mode = filterMode(col);
        var f = state.filters[col.key];

        if (mode === 'date') {
            if (!f || (!f.from && !f.to)) return true;
            var raw = row[col.key];
            if (!raw) return false;
            var t = new Date(raw).getTime();
            if (isNaN(t)) return false;
            if (f.from && t < new Date(f.from + 'T00:00:00').getTime()) return false;
            if (f.to && t > new Date(f.to + 'T23:59:59.999').getTime()) return false;
            return true;
        }

        if (mode === 'select') {
            if (!f) return true;
            var rv = row[col.key];
            return String(rv === null || rv === undefined ? '' : rv) === f;
        }

        var needle = (f || '').trim().toLowerCase();
        if (!needle) return true;
        return displayValue(row, col).toLowerCase().indexOf(needle) !== -1;
    }

    function applyFilters(rows) {
        var cols = currentColumns();
        var search = state.search.trim().toLowerCase();
        return rows.filter(function (row) {
            for (var i = 0; i < cols.length; i++) {
                if (!matchesFilter(row, cols[i])) return false;
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
                state.page = 1;
                render();
            });
            headerRow.appendChild(th);

            var fth = document.createElement('th');
            fth.appendChild(buildFilterControl(col));
            filterRow.appendChild(fth);
        });
    }

    function buildFilterControl(col) {
        var mode = filterMode(col);

        if (mode === 'date') {
            var range = state.filters[col.key] || {};
            var bounds = dateBounds(col.key);
            var wrap = document.createElement('div');
            wrap.className = 'date-filter';

            var make = function (which, labelText) {
                var label = document.createElement('label');
                var span = document.createElement('span');
                span.textContent = labelText;
                var inp = document.createElement('input');
                inp.type = 'date';
                if (bounds.min) inp.min = bounds.min;
                if (bounds.max) inp.max = bounds.max;
                inp.value = range[which] || '';
                inp.addEventListener('change', function () {
                    var cur = state.filters[col.key] || {};
                    cur = { from: cur.from || '', to: cur.to || '' };
                    cur[which] = inp.value;
                    state.filters[col.key] = cur;
                    refreshBody();
                });
                label.appendChild(span);
                label.appendChild(inp);
                return label;
            };

            wrap.appendChild(make('from', 'From'));
            wrap.appendChild(make('to', 'To'));
            return wrap;
        }

        if (mode === 'select') {
            var sel = document.createElement('select');
            sel.dataset.key = col.key;
            populateSelect(sel, col.key);
            sel.addEventListener('change', function () {
                state.filters[col.key] = sel.value;
                refreshBody();
            });
            return sel;
        }

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'filter';
        input.value = state.filters[col.key] || '';
        input.addEventListener('input', function () {
            state.filters[col.key] = input.value;
            refreshBody();
        });
        return input;
    }

    // (Re)fill a select with its cascaded option list, preserving the current
    // selection — even if that value is no longer reachable (kept visible so the
    // active filter isn't silently dropped).
    function populateSelect(sel, key) {
        var current = state.filters[key] || '';
        var values = cascadedValues(key);
        if (current && values.indexOf(current) === -1) values.unshift(current);

        sel.innerHTML = '';
        var all = document.createElement('option');
        all.value = '';
        all.textContent = '(all)';
        sel.appendChild(all);
        values.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        });
        sel.value = current;
    }

    // Recompute every dropdown's cascaded options after a filter/search change.
    function updateSelects() {
        var cols = currentColumns();
        var filterRow = document.getElementById('filter-row');
        cols.forEach(function (col) {
            if (filterMode(col) !== 'select') return;
            var sel = filterRow.querySelector('select[data-key="' + col.key + '"]');
            if (sel) populateSelect(sel, col.key);
        });
    }

    // Re-render only the table body + pager (used by filter/search/page changes
    // so the header's filter controls keep focus and aren't rebuilt). Dropdown
    // option lists cascade to reflect the other active filters.
    function refreshBody() {
        state.page = 1;
        updateSelects();
        renderBody();
    }

    function renderBody() {
        var cols = currentColumns();
        var rows = applySort(applyFilters(currentRows()));
        var total = rows.length;

        // Paging
        var pageSize = state.pageSize;
        var totalPages = 1;
        var pageRows = rows;
        if (pageSize > 0) {
            totalPages = Math.max(1, Math.ceil(total / pageSize));
            if (state.page > totalPages) state.page = totalPages;
            if (state.page < 1) state.page = 1;
            var start = (state.page - 1) * pageSize;
            pageRows = rows.slice(start, start + pageSize);
        } else {
            state.page = 1;
        }

        var tbody = document.getElementById('data-body');
        var frag = document.createDocumentFragment();

        pageRows.forEach(function (row) {
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

        document.getElementById('empty-state').hidden = total !== 0;
        document.getElementById('row-status').textContent =
            total + ' of ' + currentRows().length + ' rows';

        renderPager(total, totalPages, pageRows.length);

        // Stash the FULL filtered set (not just the page) for export
        renderBody._lastFiltered = rows;
        renderBody._lastCols = cols;
    }

    function renderPager(total, totalPages, shownOnPage) {
        var info = document.getElementById('page-info');
        var first = document.getElementById('page-first');
        var prev = document.getElementById('page-prev');
        var next = document.getElementById('page-next');
        var last = document.getElementById('page-last');

        if (state.pageSize === 0) {
            info.textContent = 'All ' + total + ' rows';
        } else if (total === 0) {
            info.textContent = 'Page 0 of 0';
        } else {
            var from = (state.page - 1) * state.pageSize + 1;
            var to = from + shownOnPage - 1;
            info.textContent = 'Page ' + state.page + ' of ' + totalPages +
                ' (' + from + '–' + to + ')';
        }

        var atFirst = state.pageSize === 0 || state.page <= 1;
        var atLast = state.pageSize === 0 || state.page >= totalPages || total === 0;
        first.disabled = atFirst;
        prev.disabled = atFirst;
        next.disabled = atLast;
        last.disabled = atLast;
        renderPager._totalPages = totalPages;
    }

    function gotoPage(p) {
        var totalPages = renderPager._totalPages || 1;
        if (p === 'last') p = totalPages;
        state.page = Math.min(Math.max(1, p), totalPages);
        renderBody();
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
                state.page = 1;
                document.getElementById('search').value = '';
                state.search = '';
                render();
            });
        });

        document.getElementById('search').addEventListener('input', function (e) {
            state.search = e.target.value;
            refreshBody();
        });

        document.getElementById('clear-filters').addEventListener('click', function () {
            state.filters = {};
            state.search = '';
            state.page = 1;
            document.getElementById('search').value = '';
            render();
        });

        document.getElementById('page-size').addEventListener('change', function (e) {
            state.pageSize = parseInt(e.target.value, 10) || 0;
            state.page = 1;
            renderBody();
        });

        document.getElementById('page-first').addEventListener('click', function () { gotoPage(1); });
        document.getElementById('page-prev').addEventListener('click', function () { gotoPage(state.page - 1); });
        document.getElementById('page-next').addEventListener('click', function () { gotoPage(state.page + 1); });
        document.getElementById('page-last').addEventListener('click', function () { gotoPage('last'); });

        document.getElementById('export-csv').addEventListener('click', exportCsv);
        document.getElementById('export-pdf').addEventListener('click', exportPdf);
    }

    renderMeta();
    bindUi();
    render();
})();
