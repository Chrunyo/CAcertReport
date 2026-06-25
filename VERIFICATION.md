# Verification

This note records the manual verification of the static web report
(`web/index.html` + `web/app.js`) after the filtering and paging changes.

## How it was verified

The page was loaded headlessly via `file://` (no server, matching real usage)
and its JavaScript was allowed to execute, then the rendered DOM was inspected:

```powershell
$root   = "<repo>\"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url    = "file:///" + ($root + "web\index.html").Replace('\','/')
& $chrome --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom $url > dom.html
```

A full render with populated content confirms `app.js` ran to completion with
no fatal error — any uncaught exception in the script would leave the table
body and dropdowns empty.

## Results

Against the bundled sample data (`web/data/data.js`, Issued view = 8 rows):

| Check                | Expected                              | Observed                     |
|----------------------|---------------------------------------|------------------------------|
| Data rows            | 8 rows in the table body              | 8 of 8 rows                  |
| Pager                | page indicator + rows-per-page select | `Page 1 of 1 (1–8)`          |
| Column dropdowns     | Requester / Template / Status         | populated (`(all)` + values) |
| Page-size select     | present                               | present                      |
| Date range pickers   | Valid From + Valid To, each from/to   | 4 `type="date"` inputs       |
| Dropdown values      | distinct values from the data         | `CONTOSO\alice`, `WebServer`, … |

The cascade behaviour was additionally checked by simulating a facet against
the sample data: selecting `Template = IPSecIntermediate` correctly narrows the
Requester dropdown to the single reachable value (`CONTOSO\svc-vpn`).

The report opens correctly directly from disk (`file://`), with no web server
or build step required.
