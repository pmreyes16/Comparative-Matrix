# CRS Comparative Analysis — User Guide

A step-by-step guide to using the app. For installation / developer setup, see
[README.md](README.md).

Everything runs in your browser — nothing is uploaded to a server. If you
close the tab, your work is auto-saved locally and offered back to you next
time you open the app.

---

## 1. Getting started

1. Open the app (`npm run dev` and go to `http://localhost:5173`, or open
   `insurance-comparator.html` directly in a browser for the no-install
   version).
2. **Upload quotation slips** — drag and drop files onto the upload zone, or
   click it to pick files. You can upload several at once.
   - Supported formats: **PDF, Excel (.xlsx/.xls), Word (.docx)**.
   - Legacy binary `.doc` files aren't supported — re-save as `.docx` first.
3. Each uploaded file appears as a **chip** showing its detected insurer and
   status:
   - **Processing** — being read.
   - **Parsed** — extracted cleanly.
   - **Needs review** — some fields were low-confidence or came from loose
     text rather than a table; check these against the original slip.
   - **Error** — couldn't be read (corrupted, password-protected, or an
     unsupported format). This doesn't block the rest of your comparison.
   - Click the **✕** on a chip to remove that file and its data.
4. Once you have two or more slips uploaded, the comparison views appear
   automatically.

> **Picking up earlier work:** if the app finds an auto-saved comparison from
> your last session, it offers **Restore** at the top of the start screen. You
> can also click **Open** in the header at any time to load a `.comparison.json`
> file you saved earlier (see [Section 5](#5-save-your-work-and-reopen-it)).

---

## 2. The three comparison views

Once slips are uploaded, switch between views using the toggle in the header:
**Overview**, **Best Fit**, **Matrix**.

### Overview (default)

A dashboard-style summary of everything you've uploaded:

- Headline numbers — proposals compared, lowest/highest total premium,
  computed potential saving.
- An auto-written analysis summary.
- An **interactive price ↔ coverage value ranker** — drag the slider to
  change how much weight goes to price vs. coverage; the ranking updates
  live.
- Per-slip **data-quality bars** (how much of the slip was confidently read).
- A premium comparison chart.
- A "differences at a glance" panel.

Everything on this page reacts to the filters described in
[Section 3](#3-sorting-filtering-and-searching).

### Best Fit

A weighted, multi-criteria ranking across **Total Premium, Premium Rate,
Brokerage Rate, Clauses & Warranties, Sum Insured** and **Deductibles**.

- Drag each criterion's slider (0–100) to set how much it matters — 0 means
  "ignore this criterion."
- Use the preset buttons for a quick starting point:
  - **Balanced** — an even mix of price and coverage.
  - **Lowest cost** — weights price factors heavily.
  - **Broadest cover** — weights coverage/clauses heavily.
- The ranked list updates live and shows the highest-scoring insurer.
- Every criterion reads the same value shown in the Matrix — if you edit a
  figure there, this ranking updates too.

This is a comparison aid, not a recommendation — always verify against the
original slips before deciding.

### Matrix

A broker-style **comparative / compliance matrix**, modelled on a quotation
slip: one **"proposed terms"** baseline column plus one column per insurer.

1. **Pick a baseline** using **Benchmark against** at the top — choose any
   uploaded proposal as the "proposed terms," or **No baseline** for a plain
   side-by-side view.
2. Each cell then shows:
   - **✓ (green)** — matches the baseline / proposed terms exactly.
   - **Shaded cell with text** — a deviation from the baseline, with the
     actual wording/figure from that insurer's slip.
   - **DELETED (red)** — that insurer doesn't offer this item at all.
   - **— (blank)** — not applicable / not detected.
3. **Every cell is click-to-edit.** Click any value to correct or fill it in
   manually — your edit flows straight back into the Overview and Best Fit
   analytics, so you only need to fix a figure once.
4. Use **Export Excel** or **Export PDF** (top-right of the matrix) to
   download the matrix as a real, formatted file — the PDF is A3 landscape
   for wide comparisons.

---

## 3. Sorting, filtering and searching

The control bar above Overview/Best Fit/Matrix lets you narrow down what's
shown (all comparison views respect these filters):

| Control | What it does |
| --- | --- |
| **Sort** | By total premium (low→high or high→low), sum insured (high→low), or insurer name (A→Z). |
| **Policy type** | Only appears once more than one type is present; filters to one line of insurance. |
| **Max premium** | Drag the slider to hide proposals above a premium threshold. |
| **Clause/add-on** | Type a keyword (e.g. "acts of nature") to filter to slips whose cover or clauses mention it. |
| **Search** | Free-text search across every field of every slip. |

Automatic badges also appear on cards/columns: **Best Price** (lowest total
premium among what's shown) and **Most Coverage** (broadest clauses/cover) —
both clearly labelled as automatic, not a recommendation. A **Quote lapsed**
flag appears if a slip's validity date has passed today.

---

## 4. Generate a Proposal

Click **Generate a Proposal** in the header to produce a client-ready
recommendation document, built from your current comparison:

- An executive summary and an overall **recommended insurer** with a
  balanced score out of 100.
- **"Where each insurer leads"** — the straight winner per headline
  criterion, independent of any weighting.
- Additional considerations: protection-adequacy notes, what sets the
  recommended insurer apart, and warnings for slips that still need manual
  review or have a lapsed quote.
- A full comparison-detail appendix.

Click **Export PDF** to download it. This is a comparison aid, not binding
advice — the document itself says so, and figures should always be verified
against the original slips.

---

## 5. Save your work and reopen it

- **Save** (on the Matrix view) downloads the entire comparison — every
  proposal, your chosen baseline, and every manual edit — as a
  `.comparison.json` file. Keep this file; it's the exact state of your work.
- **Open** (top of the header, or the link on the start screen) loads a
  `.comparison.json` file back in, exactly as you left it.
- Your work is also **auto-saved in the browser** as you go, so an accidental
  refresh won't lose it — you'll be offered **Restore** next time you open the
  app in that browser.

---

## 6. Archive

Click **Archive** in the header to see every matrix you've saved in this
browser:

- **Search** by client or title, filter by policy type/date, sort, and page
  through results.
- Per row: **View** (read-only), **Restore** (load it back into the app to
  keep editing), **Excel** / **PDF** (re-export without reopening it), and
  **Delete**.
- **⬇ Back up to file** downloads your entire archive as one file — do this
  before clearing browser data, switching machines, or if you're using a
  sandboxed/temporary preview that can't save to the browser at all.
- **⬆ Restore from file** loads an archive backup back in.

---

## 7. Document Control (standard templates)

Click **Document Control** in the header to manage your firm's standard
Quotation Slip templates, one per line of insurance:

1. Pick a line of insurance from the dropdown.
2. Upload its template file (`.docx`, `.xlsx` or `.pdf`) — it's saved
   permanently in this browser (via IndexedDB) so you only do this once.
3. Pick which uploaded proposal to pull data from, then generate — the app
   fills the template with that proposal's figures and downloads the result.
4. You can also **bulk-upload** many template files at once by dropping them
   together; each is matched to its line of insurance automatically by
   filename.
5. Replace or remove a line's template at any time from the same screen.

---

## 8. Co-insurance and logos

- If a slip lists **multiple insurers sharing percentages** (co-insurance),
  the app renders it as **one grouped card**, not competing cards.
- **Logos** are extracted automatically where possible (most reliable from
  `.docx` files). If none is found, you'll see an initials badge — click
  **Assign logo** on that insurer to upload one manually.

---

## 9. Things to keep in mind

- **Figures are always shown verbatim** from the slip, including trailing
  zeros (e.g. `500,000.00`). Anything the app calculates itself (spread,
  saving %, value score) is labelled **"computed"** so it's never mistaken
  for a number copied from a document.
- If a figure can't be read, you'll see **"Not detected — verify manually"**
  — the app never guesses a number.
- Extraction is heuristic and works best on tabular slips; always verify
  figures against the original document before making a decision, especially
  for anything flagged **Needs review**.
- Password-protected or corrupted files will show an error on their chip but
  won't block the rest of your comparison.

---

*Auto-extracted for comparison purposes. Always verify figures against the
original quotation slip before making a decision.*
