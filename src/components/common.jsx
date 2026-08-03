import React, { useRef, useState } from 'react';
import { formatMoney, parseMoney, sectionsOf } from '../lib/money.js';
import { initials, colorFor } from '../lib/logo.js';

export function Logo({ name, url, size = 40 }) {
  const s = { width: size, height: size };
  if (url) {
    return (
      <div
        className="rounded-md bg-white ring-1 ring-slate-200 flex items-center justify-center overflow-hidden shrink-0"
        style={s}
      >
        <img src={url} alt={name + ' logo'} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className={'rounded-md text-white flex items-center justify-center font-semibold shrink-0 ' + colorFor(name)}
      style={s}
    >
      {initials(name)}
    </div>
  );
}

export function InsurerHeader({ prop, onAssignLogo }) {
  const fileRef = useRef();
  const multi = prop.insurers.length > 1;
  const primary = prop.insurers[0] || { name: prop.fileName || 'Unknown insurer' };
  return (
    <div className="flex items-start gap-3">
      <Logo name={primary.name} url={primary.logoUrl} />
      <div className="min-w-0 flex-1">
        {multi ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">
              Co-insurance placement
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {prop.insurers.map((ins, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-800 truncate">{ins.name || 'Unnamed'}</span>
                  {ins.percentageShare && (
                    <span className="text-xs font-medium text-slate-500 tnum">{ins.percentageShare}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="font-semibold text-slate-800 leading-tight truncate">
            {primary.name || 'Unknown insurer'}
          </div>
        )}
        <button
          className="mt-1 text-[11px] text-cobalt-600 hover:underline"
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          Assign logo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files[0];
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => onAssignLogo(prop.id, rd.result);
            rd.readAsDataURL(f);
          }}
        />
      </div>
    </div>
  );
}

export function ConfidenceDot({ level }) {
  const map = { high: 'bg-teal-500', medium: 'bg-rosegold-500', low: 'bg-poppy-500' };
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <span className={'w-2 h-2 rounded-full ' + (map[level] || 'bg-slate-400')} />
      {level} confidence
    </span>
  );
}

export function Amount({ money, big }) {
  const txt = formatMoney(money);
  const unknown = !money || !money.amountDisplay;
  return (
    <span
      className={
        (big ? 'text-2xl font-bold ' : 'text-sm ') +
        'mono-amt tnum ' +
        (unknown ? 'text-poppy-500 text-sm font-normal italic' : 'text-slate-900')
      }
    >
      {txt}
    </span>
  );
}

export function Badge({ children, tone }) {
  const tones = {
    price: 'bg-teal-100 text-teal-800 ring-teal-200',
    cover: 'bg-cobalt-100 text-cobalt-700 ring-cobalt-200',
    lapse: 'bg-poppy-100 text-poppy-800 ring-poppy-200',
    review: 'bg-rosegold-100 text-rosegold-800 ring-rosegold-200',
    brand: 'bg-cobalt-50 text-cobalt-700 ring-cobalt-200',
  };
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ' +
        (tones[tone] || 'bg-slate-100 text-slate-700 ring-slate-200')
      }
    >
      {children}
    </span>
  );
}

export function Section({ title, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-slate-100 pt-2">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        <span className="text-slate-400 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="mt-1.5 text-sm text-slate-700 space-y-1.5">{children}</div>}
    </div>
  );
}

export function Field({ label, value }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
        {value ? value : <span className="italic text-slate-400">—</span>}
      </div>
    </div>
  );
}

/**
 * Click-to-edit money field. Typing is always allowed — especially useful when
 * a figure wasn't detected from the proposal. The typed value is stored VERBATIM
 * (parseMoney keeps trailing zeros); non-numeric input is kept as-is so nothing
 * the user enters is silently dropped.
 */
export function EditableAmount({ money, onChange, placeholder, big }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const display = money && money.amountDisplay ? (money.symbol || '') + ' ' + money.amountDisplay : '';
  const commit = () => {
    setEditing(false);
    const t = (val || '').trim();
    if (!t) return onChange(null);
    onChange(parseMoney(t) || { amountDisplay: t, amount: null, currency: 'PHP', symbol: '' });
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="e.g. 500,000.00"
        className={'w-full mono-amt tnum rounded border border-cobalt-500 px-1.5 py-0.5 outline-none ' + (big ? 'text-lg font-bold' : 'text-sm')}
      />
    );
  }
  return (
    <button
      type="button"
      title="Click to edit"
      onClick={() => { setVal(money && money.amountDisplay ? money.amountDisplay : ''); setEditing(true); }}
      className={'group text-left mono-amt tnum ' + (display ? (big ? 'text-2xl font-bold text-slate-900' : 'text-sm text-slate-900') : 'text-sm italic text-poppy-500')}
    >
      {display || placeholder || 'Not detected — tap to enter'}
      <span className="ml-1 align-middle text-[10px] text-slate-300 group-hover:text-cobalt-500 no-print">✎</span>
    </button>
  );
}

/** Click-to-edit plain text field (for rate strings like "0.15%"). */
export function EditableText({ value, onChange, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => { setEditing(false); onChange((val || '').trim()); };
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full text-sm rounded border border-cobalt-500 px-1.5 py-0.5 outline-none"
      />
    );
  }
  return (
    <button type="button" title="Click to edit" onClick={() => { setVal(value || ''); setEditing(true); }}
      className={'group text-left text-sm ' + (value ? 'text-slate-700' : 'text-slate-400 italic')}>
      {value || placeholder || 'Tap to enter'}
      <span className="ml-1 text-[10px] text-slate-300 group-hover:text-cobalt-500 no-print">✎</span>
    </button>
  );
}

/** Editable, labelled sub-fields for Sum Insured / Deductibles (Section I, II, …). */
export function SectionedAmount({ field, onChange }) {
  const secs = sectionsOf(field);
  const update = (next) => onChange({ sections: next });
  const setSec = (i, patch) => { const n = secs.slice(); n[i] = { ...n[i], ...patch }; update(n); };
  const addSection = () => update([...secs, { label: 'New section', money: null }]);
  const removeSection = (i) => { const n = secs.slice(); n.splice(i, 1); update(n); };
  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 divide-y divide-slate-200">
      {secs.map((s, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <EditableText value={s.label} onChange={(v) => setSec(i, { label: v })} placeholder="Section label" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <EditableAmount money={s.money} onChange={(m) => setSec(i, { money: m })} placeholder="Tap to enter" />
            <button type="button" onClick={() => removeSection(i)} title="Remove section" className="text-slate-300 hover:text-poppy-500 text-xs no-print">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addSection} className="w-full text-left px-2.5 py-1 text-[11px] text-cobalt-600 hover:underline no-print">+ Add section</button>
    </div>
  );
}

/** Editable, labelled sub-fields with text values (e.g. Premium Rate sections). */
export function SectionedText({ field, onChange }) {
  const secs = sectionsOf(field);
  const update = (next) => onChange({ sections: next });
  const setSec = (i, patch) => { const n = secs.slice(); n[i] = { ...n[i], ...patch }; update(n); };
  const addSection = () => update([...secs, { label: 'New section', value: '' }]);
  const removeSection = (i) => { const n = secs.slice(); n.splice(i, 1); update(n); };
  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 divide-y divide-slate-200 overflow-hidden">
      {secs.map((s, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
          <div className="min-w-0 flex-1"><EditableText value={s.label} onChange={(v) => setSec(i, { label: v })} placeholder="Section label" /></div>
          <span className="text-slate-300">:</span>
          <div className="min-w-0 flex-1"><EditableText value={s.value} onChange={(v) => setSec(i, { value: v })} placeholder="Tap to enter" /></div>
          <button type="button" onClick={() => removeSection(i)} title="Remove section" className="text-slate-300 hover:text-poppy-500 text-xs no-print">✕</button>
        </div>
      ))}
      <button type="button" onClick={addSection} className="w-full text-left px-2.5 py-1 text-[11px] text-cobalt-600 hover:underline no-print">+ Add section</button>
    </div>
  );
}

export function PremiumBlock({ premium, editable, hideTotal, onEditItem, onEditTotal }) {
  const items = (premium && premium.lineItems) || [];
  const hasAny = premium && (premium.total || items.length);
  if (!hasAny && !editable) {
    return <div className="text-sm italic text-poppy-500">Not detected — verify manually</div>;
  }
  if (hideTotal && !items.length) {
    return <div className="text-sm italic text-slate-400">No premium charges detected</div>;
  }
  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 divide-y divide-slate-200 overflow-hidden">
      {items.map((li, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="text-sm text-slate-600">{li.label}</span>
          {editable ? <EditableAmount money={li.money} onChange={(m) => onEditItem(i, m)} /> : <Amount money={li.money} />}
        </div>
      ))}
      {!hideTotal && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-100">
          <span className="text-sm font-semibold text-slate-700">
            {premium && premium.total ? premium.total.label : 'TOTAL PREMIUM'}
          </span>
          {editable ? (
            <EditableAmount money={premium && premium.total ? premium.total.money : null} onChange={onEditTotal} placeholder="Tap to enter total" big />
          ) : premium && premium.total ? (
            <Amount money={premium.total.money} big />
          ) : (
            <span className="text-sm italic text-poppy-500">Total not stated — verify manually</span>
          )}
        </div>
      )}
    </div>
  );
}
