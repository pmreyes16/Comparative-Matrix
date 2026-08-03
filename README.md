# CRS Comparative Analysis — Insurance Proposal / Comparative Slip Comparator

A client-side web app that compares insurance proposals / comparative quotation
slips (non-life and motor — e.g. Erection All Risks, Fire, Comprehensive Motor,
CTPL) from multiple insurers, side by side. Upload **PDF, Excel (.xlsx/.xls) or
Word (.docx)** files; the app extracts the key fields and lets you sort, filter,
search, edit and export. No backend, no database — everything runs in the
browser.

> There is also a **single-file version** (`insurance-comparator.html`) that
> needs no install — just open it in a browser. This project is the modular
> Vite/React equivalent, easier to extend. `insurance-comparator-source.html` is
> the readable (unbundled) form of that same single-file build.

## What you need to install

**Node.js 20.19+ (or 22.12+)** — Vite 7 requires it. Check with `node -v`.
That is the *only* system prerequisite; everything else is an npm package.

```bash
npm install     # installs everything listed below
npm run dev     # http://localhost:5173
npm run build   # production build in dist/
npm run preview # serve the production build
```

`npm install` pulls these in (already declared in `package.json` — you do not
install them individually):

| Package | Why it's needed |
| --- | --- |
| `react`, `react-dom` | UI |
| `pdfjs-dist` | reads `.pdf` slips (text + annotations) |
| `xlsx` (SheetJS) | reads `.xlsx` / `.xls`, writes the Excel export |
| `mammoth` | reads `.docx`, including embedded logo images |
| `jspdf` + `jspdf-autotable` | writes the PDF export (A3 landscape) |
| `vite`, `@vitejs/plugin-react` | dev server + build |
| `tailwindcss`, `postcss`, `autoprefixer` | styling (driven by `postcss.config.js`) |

> `xlsx` is installed from the SheetJS CDN tarball, not the npm registry — that
> is intentional and already pinned in `package.json`. It needs network access
> to `cdn.sheetjs.com` on first install.

There is **nothing to configure to run the app.** The one optional `.env`
setting (AI extraction) is described under *Optional AI extraction* below.

## What it does

- **Multi-file upload** (drag-and-drop or picker) across PDF / Excel / Word.
- **Per-file chips** showing detected insurer + status (processing / parsed /
  needs review / error). Remove and re-upload freely.
- **Three views** from one screen (toggle, no page navigation):
  - **Overview** (default) — an overall-analysis dashboard: headline KPIs
    (proposals compared, lowest / highest total premium, computed potential
    saving), an auto-written analysis summary, an **interactive price ↔ coverage
    value ranker** (drag to reweight; ranking updates live), per-slip data-quality
    bars, a premium chart, and a "differences at a glance" panel. Everything
    reacts to the active filters.
  - **Best Fit** — weighted multi-criteria scoring across Total Premium, Premium
    Rate, Brokerage Rate, Clauses & Warranties, Sum Insured and Deductibles, with
    *Balanced* / *Lowest cost* / *Broadest cover* presets. Every criterion reads
    the same value shown in the Matrix, so manual edits are respected.
  - **Matrix** — a broker-style **comparative / compliance matrix** modelled on
    a real Howden quotation slip: a baseline **"proposed terms"** column plus one
    column per insurer, where each cell is a **✓ (as proposed)** when it matches
    the baseline or the specific **deviation text** otherwise (DELETED shown in
    red, blanks as "—"). Dark title band, legend, sticky first column + header,
    section grouping, and a per-insurer footnotes area. Pick any uploaded
    proposal as the benchmark, or "No baseline" for a plain side-by-side.
    **Every cell is click-to-edit**; edits flow back into the analytics.
- **Save / Open** — *Save* downloads the whole comparison (proposals, baseline
  and every manual edit) as a `.comparison.json` file you keep; *Open* on the
  start screen restores it exactly. Work is also auto-saved to the browser so a
  refresh doesn't lose it.
- **Archive** — saved matrices kept in this browser, with search / policy-type /
  date filters, sort, pagination, per-row View / Restore / Excel / PDF / Delete,
  plus **Back up to file** and **Restore from file** so the archive survives a
  sandboxed preview or a change of machine.
- **Live interactivity** — sort by premium / sum insured / insurer name; filter
  by policy type, premium range, and clause/add-on keyword; global keyword
  search; auto badges (**Best Price**, **Most Coverage** — clearly labelled as
  automatic); **Quote lapsed** flag vs. today's date.
- **Co-insurance** — a slip listing multiple insurers with percentage shares
  renders as one grouped card, not competing cards.
- **Logos** — best-effort embedded-image extraction from `.docx`; otherwise an
  initials badge, with a manual "Assign logo" option per insurer.

**Export.** The matrix title bar has **Export Excel** (a real `.xlsx` written
client-side via SheetJS) and **Export PDF** (a real `.pdf` via jsPDF +
autoTable, A3 landscape; falls back to a printable HTML document if the PDF
engine is unavailable). Both live in `src/lib/exportMatrix.js`.

**Branding.** The palette uses Howden's magenta (`#E6007E`) and blue (`#0047AB`)
with a charcoal matrix header; the ✓ / deviation / deleted cells follow a
red-amber-green (RAG) system. The brand colours are defined inline as Tailwind
arbitrary values — swap them for your exact brand swatches if they differ.

> **Verbatim vs computed:** slip figures are always shown exactly as written.
> Analytics the app derives (premium spread, saving %, value score) are clearly
> labelled *computed* so they're never mistaken for a figure copied from a slip.

## Money precision (important)

Every monetary field (premium line items, premium total, sum insured,
deductibles) is handled by a single shared helper in `src/lib/money.js`. The
**exact source substring is preserved verbatim** — including trailing zeros like
`500,000.00` — in `amountDisplay`. The numeric `amount` is derived only for
sorting / range filtering and is **never rendered**. Monetary values are never
bound to a native number input, so `.00` can never be silently stripped. If an
amount can't be read, the field shows **"Not detected — verify manually"** —
it is never guessed.

## Extraction

Extraction is **heuristic/regex by default** and maps table rows + text to the
proposal schema in `src/lib/schema.js`. It is deliberately conservative: it
never fabricates a value, and fields recovered from loose (non-table) text are
flagged, surfacing a **"Needs review"** badge.

### Optional AI extraction

A browser-only app has nowhere safe to hold an API key, so AI extraction is off
by default. To enable it:

1. Stand up a tiny proxy that receives `{ text }`, calls Claude with a
   structured-output prompt (the schema in `src/lib/schema.js`), and returns
   JSON. The **proxy** holds the API key — never the browser.
2. Add a `.env` file at the project root:

   ```
   VITE_AI_ENDPOINT=https://your-proxy.example.com/extract
   ```

Instruct the model to **copy premium, sum-insured and deductible figures
character-for-character** (never round or reformat) and to return insurers as an
array when a slip lists co-insurance shares.

## Project layout

```
index.html
vite.config.js
postcss.config.js
tailwind.config.js
src/
  main.jsx
  App.jsx
  index.css
  assets/
    howden-logo.gif
  lib/
    money.js        # shared money parse/format (full-decimal precision)
    schema.js       # empty proposal shape + quote-lapse check
    logo.js         # initials + colour fallback
    parse.js        # PDF (pdfjs-dist) / Excel (xlsx) / Word (mammoth) -> {text, pairs, images}
    extract.js      # heuristic extraction + optional AI hook
    analyze.js      # overall analytics + interactive value ranking (computed figures)
    matrix.js       # builds the baseline/✓/deviation comparative matrix
    exportMatrix.js # Excel + PDF export, download + toast helpers
    archive.js      # saved-matrix archive records, backup/restore payloads
    storage.js      # localStorage with a safe in-memory fallback
  components/
    common.jsx         # Logo, InsurerHeader, Amount, Badge, Section, Field, PremiumBlock, editors
    UploadZone.jsx
    FileChips.jsx
    Controls.jsx
    PremiumChart.jsx   # dependency-free premium bar chart
    Overview.jsx       # overall-analysis dashboard + value ranker
    BestFit.jsx        # weighted multi-criteria ranking
    MatrixView.jsx     # comparative / compliance matrix renderer (click-to-edit)
    ArchiveView.jsx    # saved-matrix archive page
    ComparisonTable.jsx # legacy neutral table (kept; Matrix is the default comparison)
```

## Notes & limitations

- Legacy `.doc` (binary Word) can't be parsed in-browser — re-save as `.docx`.
- Password-protected / corrupted files surface a per-file error and don't block
  the rest of the comparison.
- Logo auto-extraction is best-effort (works most reliably for `.docx`); use
  "Assign logo" otherwise.
- Heuristic extraction quality varies with slip layout. Always verify against
  the original slip before making a decision.
- The build emits a >500 kB JS chunk (pdf.js, SheetJS, mammoth and jsPDF are all
  bundled). That is a size warning, not an error; code-split with dynamic
  `import()` if it matters for your deployment.

---

*Auto-extracted for comparison purposes. Always verify figures against the
original quotation slip before making a decision.*
