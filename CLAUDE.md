# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The application creates and runs a report of issued certificates. The report is provided as a simple web application for use in a web browser.

## Application features
- retrieves data from Windows certification authority
- creates and runs a web report

### Report features
- a page with a list of issued certificates
- filtering per column -- per certificate attributes
- searching through attributes
- CSV export of filtered items
- PDF export of aggregated summaries

### Data retrieval
- runs as a scheduled task
- regularly queries a certificate authority service
- retrieves records about issued certificates, or refused requests

### Report run
- generates and runs web report

## implementation details

- for data retrieval, use Windows logs, if possible, otherwise certutil.exe
- report web application will run on Windows, on .NET.
- static pages are preferred, with as simple scripting as possible

## Solution

### Layout

```
CAcertReport/
├── scripts/
│   ├── Get-CAReport.ps1        # certutil-based collector → web/data/data.js
│   ├── Install-CAReport.ps1    # registers daily SYSTEM scheduled task
│   └── Uninstall-CAReport.ps1
└── web/
    ├── index.html              # report UI
    ├── app.js                  # vanilla JS, zero external deps
    ├── styles.css
    └── data/
        └── data.js             # sample data; overwritten by the collector
```

### How it works

- `Get-CAReport.ps1` runs `certutil -view -restrict ... -out ... csv` for issued
  certs (`Disposition=20`) and failed/denied requests (`Disposition>=30`),
  normalizes columns, and writes both `data.js` (for the page) and `data.json`
  (for ad-hoc use). Output is UTF-8 so non-ASCII names survive.
- `Install-CAReport.ps1` registers `CAcertReport-Refresh` running daily at 03:00
  under SYSTEM with `-RunLevel Highest`, then triggers it once to populate data.
- `index.html` + `app.js` are fully static — no CDN, no build step, no `fetch`
  (`data.js` is loaded via `<script>`), so it works opened directly via `file://`
  or hosted on IIS.
- Features: tabbed Issued / Failed views, per-column filter inputs, global
  search, click-to-sort headers, CSV export of the **filtered** rows (UTF-8 with
  BOM for Excel), and a Summary tab whose print stylesheet hides everything
  else — so `Print → Save as PDF` produces a clean aggregated PDF.

### Deployment

Run on the CA server (or any host with the CA RSAT tools):

```powershell
.\scripts\Install-CAReport.ps1
# or against a non-local CA:
.\scripts\Install-CAReport.ps1 -ConfigString "ca01.contoso.com\Contoso Issuing CA"
```

Then point a browser (or an IIS virtual directory) at `web\index.html`.
