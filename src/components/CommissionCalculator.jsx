import React, { useEffect, useMemo, useState } from 'react';
import { PRESETS, defaultConfig, calculate, fmtAmt, figuresFromProposal, slugId, RESERVED } from '../lib/commission.js';
import { nameOf } from '../lib/proposal.js';
import { storageGet, storageSet } from '../lib/storage.js';
import { toast, triggerDownload } from '../lib/exportMatrix.js';

const STORE_KEY = 'crs-commission';

function loadConfig() {
  try {
    const raw = storageGet(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.buildup) && Array.isArray(d.adjustments)) return { ...defaultConfig(), ...d };
    }
  } catch (e) { /* ignore */ }
  return defaultConfig();
}

function NumberField({ label, value, onChange, suffix, prefix, hint, placeholder }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="relative mt-1">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">{prefix}</span>}
        <input
          inputMode="decimal"
          value={value}
          placeholder={placeholder || '0.00'}
          onChange={(e) => onChange(e.target.value)}
          className={'field w-full tnum ' + (prefix ? 'pl-7 ' : '') + (suffix ? 'pr-8' : '')}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">{suffix}</span>}
      </div>
      {hint && <span className="hint mt-1 block">{hint}</span>}
    </label>
  );
}

/** One editable formula line: on/off, label, formula, effect, computed amount. */
function FormulaLine({ line, result, onChange, onRemove, showEffect }) {
  const [open, setOpen] = useState(false);
  const err = line.on && result && result.error;
  return (
    <div className={'rounded-xl border px-3 py-2.5 ' + (line.on ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60')}>
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={line.on}
          onChange={(e) => onChange({ ...line, on: e.target.checked })}
          className="w-4 h-4 accent-cobalt-500 shrink-0"
          title={line.on ? 'Included — untick to leave out' : 'Excluded — tick to include'}
        />
        <input
          value={line.label}
          onChange={(e) => onChange({ ...line, label: e.target.value })}
          className={'flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none rounded px-1 -mx-1 focus:bg-slate-50 ' + (line.on ? 'text-slate-800' : 'text-slate-400')}
        />
        <span className={'tnum text-sm font-semibold shrink-0 ' + (!line.on ? 'text-slate-300' : line.effect === 'deduct' ? 'text-poppy-600' : 'text-slate-900')}>
          {line.on ? (line.effect === 'deduct' ? '−' : '+') + ' ' + fmtAmt(result ? result.amount : 0).replace('−', '') : 'off'}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[11px] text-slate-400 hover:text-cobalt-600 shrink-0" title="Edit formula">
          {open ? 'Done' : 'ƒx'}
        </button>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-poppy-600 text-xs shrink-0" title="Remove this line">✕</button>
      </div>
      {!open && (
        <div className="mt-1 pl-6 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          <code className={'font-mono ' + (err ? 'text-poppy-600' : 'text-slate-500')}>{line.formula || '—'}</code>
          {err && <span className="text-poppy-600">· {err}</span>}
          {line.note && <span className="truncate max-w-full">· {line.note}</span>}
        </div>
      )}
      {open && (
        <div className="mt-2 pl-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={line.formula}
              onChange={(e) => onChange({ ...line, formula: e.target.value })}
              spellCheck={false}
              className={'field field-sm font-mono flex-1 min-w-[12rem] ' + (err ? 'border-poppy-300' : '')}
            />
            {showEffect && (
              <div className="seg">
                {['add', 'deduct'].map((k) => (
                  <button key={k} type="button" onClick={() => onChange({ ...line, effect: k })} className={'seg-item ' + (line.effect === k ? 'seg-item-active' : '')}>
                    {k === 'add' ? 'Adds' : 'Deducts'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {err && <div className="text-[11px] text-poppy-600">{err}</div>}
          <input
            value={line.note}
            placeholder="Note (optional) — e.g. legal basis or when it applies"
            onChange={(e) => onChange({ ...line, note: e.target.value })}
            className="field field-sm w-full text-[12px]"
          />
          <div className="text-[11px] text-slate-400">
            Use this line in other formulas as <code className="font-mono text-cobalt-600">{line.id}</code>.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, muted, accent }) {
  return (
    <div className={'flex items-baseline justify-between gap-3 py-1.5 ' + (strong ? 'border-t border-slate-200 mt-1 pt-2.5' : '')}>
      <span className={(strong ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-600') + ' text-sm'}>{label}</span>
      <span className={'tnum ' + (strong ? 'text-base font-bold ' + (accent || 'text-slate-900') : 'text-sm ' + (muted ? 'text-slate-400' : 'text-slate-800'))}>{value}</span>
    </div>
  );
}

export default function CommissionCalculator({ proposals }) {
  const [cfg, setCfg] = useState(loadConfig);
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    try { storageSet(STORE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  }, [cfg]);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const r = useMemo(() => calculate(cfg), [cfg]);

  const takenIds = useMemo(() => new Set([...cfg.buildup, ...cfg.adjustments].map((l) => l.id)), [cfg]);
  const varNames = ['basic', 'rate', 'si', ...cfg.buildup.map((l) => l.id), 'gross', 'commission', ...cfg.adjustments.map((l) => l.id)];

  const updLine = (list, i, line) => set({ [list]: cfg[list].map((l, k) => (k === i ? line : l)) });
  const rmLine = (list, i) => set({ [list]: cfg[list].filter((_, k) => k !== i) });
  const addLine = (list) => {
    const label = list === 'buildup' ? 'New charge' : 'New adjustment';
    const id = slugId(label, takenIds);
    const base = list === 'buildup' ? 'basic' : 'commission';
    set({ [list]: [...cfg[list], { id, label, formula: base + ' * 0%', on: true, note: '', effect: list === 'buildup' ? 'add' : 'deduct' }] });
  };

  const applyPreset = (key) => {
    const p = PRESETS[key];
    if (!p) return;
    set({ preset: key, commission: p.commission, buildup: p.buildup(), adjustments: p.adjustments() });
  };

  const loadFrom = (p) => {
    const f = figuresFromProposal(p);
    const patch = {};
    if (f.basic != null) { patch.basic = String(f.basic); patch.inputMode = 'basic'; }
    else if (f.gross != null) { patch.gross = String(f.gross); patch.inputMode = 'gross'; }
    if (f.ratePct != null) patch.ratePct = f.ratePct;
    if (f.si != null) patch.si = String(f.si);
    set(patch);
    toast(
      'Loaded ' + nameOf(p) + (f.basic == null && f.gross != null ? ' — no basic premium line found, so working back from the total premium.' : '.') +
        (f.ratePct == null ? ' Brokerage rate not found — enter it manually.' : '')
    );
  };

  // The same formulas applied to every uploaded proposal — commission compared.
  const perProposal = useMemo(
    () =>
      (proposals || []).map((p) => {
        const f = figuresFromProposal(p);
        const c = {
          ...cfg,
          ratePct: f.ratePct != null ? f.ratePct : cfg.ratePct,
          si: f.si != null ? String(f.si) : cfg.si,
          inputMode: f.basic != null ? 'basic' : 'gross',
          basic: f.basic != null ? String(f.basic) : '',
          gross: f.gross != null ? String(f.gross) : '',
        };
        const ok = f.basic != null || f.gross != null;
        return { p, f, ok, r: ok ? calculate(c) : null, rateGuessed: f.ratePct == null };
      }),
    [proposals, cfg]
  );
  const bestNet = perProposal.filter((x) => x.ok).reduce((a, b) => (!a || b.r.netCommission > a.r.netCommission ? b : a), null);

  const breakdownText = () => {
    const lines = [];
    lines.push('COMMISSION BREAKDOWN');
    lines.push('Basic premium' + (r.solvedFromGross ? ' (worked back from gross)' : '') + ': ' + fmtAmt(r.basic));
    r.buildup.filter((l) => l.on).forEach((l) => lines.push('  + ' + l.label + ' [' + l.formula + ']: ' + fmtAmt(l.amount)));
    lines.push('Gross premium (client pays): ' + fmtAmt(r.gross));
    lines.push('');
    lines.push('Brokerage commission [' + cfg.commission + ', rate ' + cfg.ratePct + '%]: ' + fmtAmt(r.commission));
    r.adjustments.filter((l) => l.on).forEach((l) => lines.push('  ' + (l.effect === 'deduct' ? '−' : '+') + ' ' + l.label + ' [' + l.formula + ']: ' + fmtAmt(l.amount)));
    lines.push('Net commission to broker: ' + fmtAmt(r.netCommission));
    lines.push('Remit to insurer (gross − commission): ' + fmtAmt(r.remitToInsurer));
    lines.push('');
    lines.push('Illustrative only — confirm rates and computation with the insurer and current BIR / LGU rules.');
    return lines.join('\n');
  };

  const copy = async () => {
    const t = breakdownText();
    try { await navigator.clipboard.writeText(t); toast('Breakdown copied to clipboard.'); }
    catch (e) { triggerDownload('commission-breakdown.txt', new Blob([t], { type: 'text/plain' })); }
  };

  const downloadCsv = () => {
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['Item', 'Formula', 'Amount']];
    rows.push(['Basic premium', '', r.basic.toFixed(2)]);
    r.buildup.filter((l) => l.on).forEach((l) => rows.push([l.label, l.formula, l.amount.toFixed(2)]));
    rows.push(['Gross premium', '', r.gross.toFixed(2)]);
    rows.push(['Brokerage commission', cfg.commission + ' (rate ' + cfg.ratePct + '%)', r.commission.toFixed(2)]);
    r.adjustments.filter((l) => l.on).forEach((l) => rows.push([l.label, l.formula, l.signed.toFixed(2)]));
    rows.push(['Net commission', '', r.netCommission.toFixed(2)]);
    rows.push(['Remit to insurer', 'gross - commission', r.remitToInsurer.toFixed(2)]);
    if (perProposal.some((x) => x.ok)) {
      rows.push([]);
      rows.push(['Insurer', 'Basic premium', 'Rate %', 'Gross premium', 'Commission', 'Net commission']);
      perProposal.filter((x) => x.ok).forEach((x) =>
        rows.push([nameOf(x.p), x.r.basic.toFixed(2), (x.r.rate * 100).toFixed(2), x.r.gross.toFixed(2), x.r.commission.toFixed(2), x.r.netCommission.toFixed(2)])
      );
    }
    triggerDownload('commission-calculation.csv', new Blob([rows.map((rw) => rw.map(esc).join(',')).join('\r\n')], { type: 'text/csv' }));
  };

  const hasErrors = Object.keys(r.errors).length > 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ------- Inputs & formulas ------- */}
        <div className="space-y-5 min-w-0">
          <div className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="kicker">Step 1</div>
                <div className="card-title">Premium & rate</div>
              </div>
              {proposals && proposals.length > 0 && (
                <select
                  value=""
                  onChange={(e) => { const p = proposals.find((x) => x.id === e.target.value); if (p) loadFrom(p); }}
                  className="field field-sm"
                  title="Fill the fields from an uploaded quotation slip"
                >
                  <option value="">Load figures from a proposal…</option>
                  {proposals.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                </select>
              )}
            </div>

            <div className="seg mb-4">
              {[['basic', 'I know the basic premium'], ['gross', 'I only know the total (gross) premium']].map(([k, t]) => (
                <button key={k} type="button" onClick={() => set({ inputMode: k })} className={'seg-item ' + (cfg.inputMode === k ? 'seg-item-active' : '')}>{t}</button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {cfg.inputMode === 'basic' ? (
                <NumberField label="Basic premium" prefix="₱" value={cfg.basic} onChange={(v) => set({ basic: v })} hint="Before taxes. Variable: basic" />
              ) : (
                <NumberField label="Gross premium (all-in)" prefix="₱" value={cfg.gross} onChange={(v) => set({ gross: v })} hint={'Basic is worked back: ' + fmtAmt(r.basic)} />
              )}
              <NumberField label="Brokerage / commission rate" suffix="%" value={cfg.ratePct} onChange={(v) => set({ ratePct: v })} placeholder="15" hint="Variable: rate" />
              <NumberField label="Sum insured (optional)" prefix="₱" value={cfg.si} onChange={(v) => set({ si: v })} hint="For per-mille formulas. Variable: si" />
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="kicker">Step 2</div>
                <div className="card-title">Taxes & charges on the premium</div>
                <p className="hint mt-0.5">Added on top of the basic premium to get what the client pays.</p>
              </div>
              <select value={cfg.preset in PRESETS ? cfg.preset : ''} onChange={(e) => applyPreset(e.target.value)} className="field field-sm" title="Reset all formulas to a preset">
                <option value="" disabled>Custom</option>
                {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {cfg.buildup.map((l, i) => (
                <FormulaLine key={l.id} line={l} result={r.buildup[i]} onChange={(nl) => updLine('buildup', i, nl)} onRemove={() => rmLine('buildup', i)} />
              ))}
              {cfg.buildup.length === 0 && <p className="text-sm text-slate-400">No charges — the gross premium equals the basic premium.</p>}
            </div>
            <button type="button" onClick={() => addLine('buildup')} className="btn btn-ghost btn-sm mt-3 -ml-2.5">+ Add a charge</button>
          </div>

          <div className="card card-pad">
            <div className="kicker">Step 3</div>
            <div className="card-title">Commission & adjustments</div>
            <p className="hint mt-0.5 mb-3">How the commission is computed, then what is added to or withheld from it.</p>
            <div className="rounded-xl border border-cobalt-200 bg-cobalt-50/50 px-3 py-2.5 mb-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-semibold text-slate-800 flex-1 min-w-[10rem]">Brokerage commission</span>
                <input
                  value={cfg.commission}
                  onChange={(e) => set({ commission: e.target.value })}
                  spellCheck={false}
                  className={'field field-sm font-mono w-48 ' + (r.errors.commission ? 'border-poppy-300' : '')}
                  title="Commission formula — e.g. basic * rate, or gross * rate if commission is on the gross premium"
                />
                <span className="tnum text-sm font-bold text-cobalt-700">{fmtAmt(r.commission)}</span>
              </div>
              {r.errors.commission && <div className="text-[11px] text-poppy-600 mt-1">{r.errors.commission}</div>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[['basic * rate', 'On basic premium'], ['gross * rate', 'On gross premium'], ['(basic + fst) * rate', 'On basic + FST']].map(([f, t]) => (
                  <button key={f} type="button" onClick={() => set({ commission: f })} className={'pill ' + (cfg.commission === f ? 'bg-cobalt-500 text-white ring-cobalt-500' : 'bg-white text-slate-600 ring-slate-200 hover:ring-cobalt-300')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {cfg.adjustments.map((l, i) => (
                <FormulaLine key={l.id} line={l} result={r.adjustments[i]} showEffect onChange={(nl) => updLine('adjustments', i, nl)} onRemove={() => rmLine('adjustments', i)} />
              ))}
            </div>
            <button type="button" onClick={() => addLine('adjustments')} className="btn btn-ghost btn-sm mt-3 -ml-2.5">+ Add an adjustment</button>
          </div>

          <div className="card card-pad">
            <button type="button" onClick={() => setShowHelp((s) => !s)} className="w-full flex items-center justify-between text-left">
              <span className="card-title">How to write a formula</span>
              <span className="text-slate-400 text-sm">{showHelp ? 'Hide' : 'Show'}</span>
            </button>
            {showHelp && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 text-[13px] text-slate-600">
                <div>
                  <div className="font-semibold text-slate-800 mb-1">You can use</div>
                  <ul className="space-y-1">
                    <li><code className="font-mono text-cobalt-600">+ − * / ( )</code> arithmetic</li>
                    <li><code className="font-mono text-cobalt-600">12.5%</code> percentages (same as 0.125)</li>
                    <li><code className="font-mono text-cobalt-600">min(a, b)</code> <code className="font-mono text-cobalt-600">max(a, b)</code> <code className="font-mono text-cobalt-600">round(x, 2)</code> <code className="font-mono text-cobalt-600">abs(x)</code></li>
                    <li>Any earlier line by its name, e.g. <code className="font-mono text-cobalt-600">dst</code></li>
                  </ul>
                  <div className="font-semibold text-slate-800 mt-3 mb-1">Names available now</div>
                  <div className="flex flex-wrap gap-1">
                    {varNames.map((v) => <code key={v} className="pill bg-slate-50 text-slate-600 ring-slate-200 font-mono">{v}</code>)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 mb-1">Examples</div>
                  <ul className="space-y-1.5">
                    <li><code className="font-mono text-cobalt-600">max(basic * 0.5%, 500)</code> — 0.5% with a ₱500 minimum</li>
                    <li><code className="font-mono text-cobalt-600">si * 1.25 / 1000</code> — a per-mille (‰) rate on the sum insured</li>
                    <li><code className="font-mono text-cobalt-600">basic / 4 * 0.50</code> — DST written as ₱0.50 per ₱4</li>
                    <li><code className="font-mono text-cobalt-600">commission * 15%</code> — 15% withholding (higher bracket)</li>
                    <li><code className="font-mono text-cobalt-600">round(basic * rate, 0)</code> — commission rounded to the peso</li>
                  </ul>
                  <p className="mt-3 text-[12px] text-slate-400">
                    Lines are worked out top to bottom, so a line can only use lines above it. Changes save automatically in this browser.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------- Result ------- */}
        <div className="xl:sticky xl:top-6 self-start space-y-4">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-ink-900 via-cobalt-800 to-cobalt-600 text-white px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-teal-300 font-semibold">Net commission to broker</div>
              <div className="text-3xl font-bold tnum mt-1">{fmtAmt(r.netCommission)}</div>
              <div className="text-[12px] text-cobalt-100/80 mt-1">
                {(r.effectiveRate * 100).toFixed(2)}% of the gross premium
              </div>
            </div>
            <div className="px-5 py-4">
              <Row label={'Basic premium' + (r.solvedFromGross ? ' (worked back)' : '')} value={fmtAmt(r.basic)} />
              {r.buildup.filter((l) => l.on).map((l) => <Row key={l.id} label={'+ ' + l.label} value={fmtAmt(l.amount)} muted />)}
              <Row label="Gross premium (client pays)" value={fmtAmt(r.gross)} strong />
              <div className="h-3" />
              <Row label="Brokerage commission" value={fmtAmt(r.commission)} />
              {r.adjustments.filter((l) => l.on).map((l) => <Row key={l.id} label={(l.effect === 'deduct' ? '− ' : '+ ') + l.label} value={fmtAmt(l.signed)} muted />)}
              <Row label="Net commission" value={fmtAmt(r.netCommission)} strong accent="text-cobalt-700" />
              <div className="h-3" />
              <Row label="Remit to insurer" value={fmtAmt(r.remitToInsurer)} />
              <p className="text-[11px] text-slate-400">Gross premium less commission, when the commission is deducted at source.</p>
              {hasErrors && (
                <div className="mt-3 rounded-lg bg-poppy-50 text-poppy-700 text-[12px] px-3 py-2">
                  Some formulas have errors and count as zero — check the lines marked in red.
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button type="button" onClick={copy} className="btn btn-secondary btn-sm flex-1">Copy breakdown</button>
              <button type="button" onClick={downloadCsv} className="btn btn-secondary btn-sm flex-1">Download CSV</button>
            </div>
          </div>
          <div className="rounded-xl bg-rosegold-50 border border-rosegold-200 px-4 py-3 text-[12px] text-rosegold-800 leading-relaxed">
            Default rates are common Philippine non-life figures and are only a starting point. Tax rules change and LGU rates vary, so confirm each rate and the insurer’s own computation before quoting a client.
          </div>
          <button type="button" onClick={() => { setCfg(defaultConfig(cfg.preset in PRESETS ? cfg.preset : 'phNonLife')); toast('Calculator reset to defaults.'); }} className="btn btn-ghost btn-sm w-full">
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ------- Across uploaded proposals ------- */}
      {perProposal.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="card-title">Commission across your uploaded proposals</div>
            <p className="hint mt-0.5">The formulas above applied to each insurer’s own premium and brokerage rate.</p>
          </div>
          <div className="overflow-x-auto cmp-scroll">
            <table className="w-full text-[13px] data-table">
              <thead>
                <tr>
                  <th className="px-5 py-2.5 text-left">Insurer</th>
                  <th className="px-3 py-2.5 text-right">Basic premium</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Gross premium</th>
                  <th className="px-3 py-2.5 text-right">Commission</th>
                  <th className="px-5 py-2.5 text-right">Net commission</th>
                  <th className="pr-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {perProposal.map((x) => (
                  <tr key={x.p.id} className="border-t border-slate-100">
                    <td className="px-5 py-2.5 font-semibold text-slate-800">
                      {nameOf(x.p)}
                      {bestNet && bestNet.p.id === x.p.id && perProposal.length > 1 && <span className="pill bg-teal-50 text-teal-700 ring-teal-200 ml-2">Highest</span>}
                    </td>
                    {x.ok ? (
                      <>
                        <td className="px-3 py-2.5 text-right tnum">{fmtAmt(x.r.basic)}{x.f.basic == null && <span className="text-slate-400" title="Worked back from the total premium">*</span>}</td>
                        <td className={'px-3 py-2.5 text-right tnum ' + (x.rateGuessed ? 'text-rosegold-700' : '')} title={x.rateGuessed ? 'Not on the slip — using the rate entered above' : ''}>
                          {(x.r.rate * 100).toFixed(2)}%{x.rateGuessed && '†'}
                        </td>
                        <td className="px-3 py-2.5 text-right tnum">{fmtAmt(x.r.gross)}</td>
                        <td className="px-3 py-2.5 text-right tnum">{fmtAmt(x.r.commission)}</td>
                        <td className="px-5 py-2.5 text-right tnum font-semibold text-cobalt-700">{fmtAmt(x.r.netCommission)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-5 py-2.5 text-right text-slate-400 italic">No premium found on this slip — enter it in the Matrix first.</td>
                    )}
                    <td className="pr-3">
                      <button type="button" onClick={() => loadFrom(x.p)} className="link text-[12px] whitespace-nowrap">Load ↑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
            * Basic premium worked back from the slip’s total premium. † Brokerage rate not on the slip — the rate entered above is used.
          </div>
        </div>
      )}
    </div>
  );
}
