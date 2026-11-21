import React, { useMemo, useState } from 'react';
import { summarizeProposal, explainCoverage, differences, recommendationDraft, searchSlips, askAI, AI_ASSIST_ENDPOINT, GLOSSARY } from '../lib/assistant.js';
import { nameOf } from '../lib/proposal.js';
import { toast, triggerDownload } from '../lib/exportMatrix.js';

const TABS = [
  { key: 'summary', label: 'Summaries' },
  { key: 'explain', label: 'Explain coverage' },
  { key: 'diff', label: 'Differences' },
  { key: 'reco', label: 'Client recommendation' },
  { key: 'ask', label: 'Ask about the slips' },
];

async function copyText(t, what) {
  try { await navigator.clipboard.writeText(t); toast((what || 'Text') + ' copied to clipboard.'); }
  catch (e) { triggerDownload('assistant.txt', new Blob([t], { type: 'text/plain' })); }
}

function SummaryCard({ p }) {
  const s = useMemo(() => summarizeProposal(p), [p]);
  const text = [s.headline, '', ...s.lines, ...(s.watch.length ? ['', 'Watch out for:', ...s.watch.map((w) => '• ' + w)] : [])].join('\n');
  return (
    <div className="card card-pad flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="kicker text-cobalt-500">{p.fileName}</div>
          <div className="card-title truncate">{s.headline}</div>
        </div>
        <button type="button" onClick={() => copyText(text, 'Summary')} className="btn btn-ghost btn-sm shrink-0">Copy</button>
      </div>
      <div className="mt-3 space-y-2 text-[14px] text-slate-700 leading-relaxed">
        {s.lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      {s.watch.length > 0 && (
        <div className="mt-4 rounded-xl bg-rosegold-50 border border-rosegold-200 px-3.5 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rosegold-700 mb-1">Watch out for</div>
          <ul className="text-[13px] text-rosegold-900 space-y-0.5">
            {s.watch.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExplainTab({ proposals }) {
  const [sel, setSel] = useState(proposals[0] ? proposals[0].id : '');
  const p = proposals.find((x) => x.id === sel) || proposals[0];
  const terms = useMemo(() => (p ? explainCoverage(p) : []), [p]);
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? GLOSSARY : terms;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={p ? p.id : ''} onChange={(e) => setSel(e.target.value)} className="field field-sm">
          {proposals.map((x) => <option key={x.id} value={x.id}>{nameOf(x)}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-cobalt-500" />
          Show the full glossary
        </label>
        <button type="button" onClick={() => copyText(list.map((g) => g.term + ' — ' + g.plain).join('\n'), 'Explanations')} className="btn btn-ghost btn-sm ml-auto">Copy all</button>
      </div>
      {!showAll && p && p.cover && (
        <div className="card card-pad">
          <div className="kicker mb-1">Cover as written on the slip</div>
          <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{p.cover}</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((g) => (
          <div key={g.term} className="card card-pad">
            <div className="text-sm font-semibold text-slate-900">{g.term}</div>
            <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{g.plain}</p>
          </div>
        ))}
      </div>
      {!showAll && terms.length === 0 && <div className="card card-pad text-sm text-slate-500">No recognised insurance terms on this slip — tick “Show the full glossary” to browse them all.</div>}
    </div>
  );
}

function DiffTab({ proposals }) {
  const d = useMemo(() => differences(proposals), [proposals]);
  if (proposals.length < 2) return <div className="card card-pad text-sm text-slate-500">Upload at least two proposals to see where they differ.</div>;
  const asText = () => {
    const out = ['WHERE THE PROPOSALS DIFFER', ''];
    d.rows.forEach((r) => { out.push(r.label); r.vals.forEach((v) => out.push('  ' + v.name + ': ' + (v.v.replace(/\s+/g, ' ').trim() || '— not stated'))); out.push(''); });
    if (d.clauses) {
      out.push('CLAUSES ONLY SOME INSURERS INCLUDE');
      d.clauses.perProposal.forEach((x) => { if (x.unique.length) { out.push('  ' + x.name + ':'); x.unique.forEach((c) => out.push('    • ' + c)); } });
    }
    return out.join('\n');
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pill bg-poppy-50 text-poppy-700 ring-poppy-200">{d.rows.length} terms differ</span>
        <span className="pill bg-teal-50 text-teal-700 ring-teal-200">{d.same.length} terms identical</span>
        {d.clauses && <span className="pill bg-slate-50 text-slate-600 ring-slate-200">{d.clauses.commonCount} clauses shared by all</span>}
        <button type="button" onClick={() => copyText(asText(), 'Differences')} className="btn btn-ghost btn-sm ml-auto">Copy</button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto cmp-scroll">
          <table className="w-full text-[13px] data-table">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left w-48">Term</th>
                {proposals.map((p) => <th key={p.id} className="px-4 py-2.5 text-left min-w-[180px]">{nameOf(p)}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{r.label}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-slate-700 whitespace-pre-wrap break-words">
                      <div className="max-h-40 overflow-y-auto cmp-scroll">{v.v || <span className="text-poppy-600 italic">Not stated</span>}</div>
                    </td>
                  ))}
                </tr>
              ))}
              {d.rows.length === 0 && <tr><td colSpan={proposals.length + 1} className="px-4 py-6 text-center text-slate-500">The extracted terms are identical across all proposals.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {d.clauses && d.clauses.perProposal.some((x) => x.unique.length) && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.clauses.perProposal.map((x) => (
            <div key={x.name} className="card card-pad">
              <div className="text-sm font-semibold text-slate-900">Only in {x.name}</div>
              {x.unique.length ? (
                <ul className="mt-2 text-[12px] text-slate-600 space-y-1 max-h-60 overflow-y-auto cmp-scroll">
                  {x.unique.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              ) : <p className="mt-2 text-[12px] text-slate-400">No clauses unique to this insurer.</p>}
            </div>
          ))}
        </div>
      )}
      {d.same.length > 0 && <p className="text-[12px] text-slate-400">Same on every slip: {d.same.join(', ')}.</p>}
    </div>
  );
}

function RecoTab({ proposals }) {
  const [clientName, setClientName] = useState('');
  const [signOff, setSignOff] = useState('Howden Philippines');
  const generated = useMemo(() => recommendationDraft(proposals, { clientName: clientName.trim(), signOff }), [proposals, clientName, signOff]);
  const [edited, setEdited] = useState(null);
  const text = edited != null ? edited : generated;
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="card card-pad space-y-3 self-start">
        <label className="block">
          <span className="field-label">Address to</span>
          <input value={clientName} onChange={(e) => { setClientName(e.target.value); setEdited(null); }} placeholder="Client name (defaults to the insured)" className="field w-full mt-1" />
        </label>
        <label className="block">
          <span className="field-label">Sign off as</span>
          <input value={signOff} onChange={(e) => { setSignOff(e.target.value); setEdited(null); }} className="field w-full mt-1" />
        </label>
        <p className="hint">The draft is built from the Best Fit scoring and the Matrix figures. Edit it freely — then copy it into an email or download it.</p>
        {edited != null && <button type="button" onClick={() => setEdited(null)} className="btn btn-ghost btn-sm -ml-2.5">↺ Regenerate (discard edits)</button>}
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Draft recommendation</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => copyText(text, 'Recommendation')} className="btn btn-secondary btn-sm">Copy</button>
            <button type="button" onClick={() => triggerDownload('client-recommendation.txt', new Blob([text], { type: 'text/plain' }))} className="btn btn-secondary btn-sm">Download .txt</button>
          </div>
        </div>
        <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={24} className="w-full px-4 py-3 text-[14px] leading-relaxed text-slate-800 outline-none resize-y font-[inherit]" />
      </div>
    </div>
  );
}

function AskTab({ proposals }) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [ai, setAi] = useState({ busy: false, text: '', error: '' });
  const res = useMemo(() => searchSlips(proposals, submitted), [proposals, submitted]);
  const suggestions = ['flood', 'earthquake deductible', 'typhoon', 'warranty', 'maintenance', 'payment', 'validity', 'third party'];
  const go = async (text) => {
    const v = (text != null ? text : q).trim();
    setQ(v);
    setSubmitted(v);
    if (AI_ASSIST_ENDPOINT && v) {
      setAi({ busy: true, text: '', error: '' });
      try { setAi({ busy: false, text: await askAI(v, proposals), error: '' }); }
      catch (e) { setAi({ busy: false, text: '', error: e.message || String(e) }); }
    }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="card card-pad">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={AI_ASSIST_ENDPOINT ? 'Ask a question about these proposals…' : 'Search every slip for a word or phrase, e.g. “flood”'} className="field flex-1" />
          <button type="submit" className="btn btn-primary">{AI_ASSIST_ENDPOINT ? 'Ask' : 'Search'}</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => go(s)} className="pill bg-slate-50 text-slate-600 ring-slate-200 hover:ring-cobalt-300">{s}</button>
          ))}
        </div>
      </form>

      {AI_ASSIST_ENDPOINT && (ai.busy || ai.text || ai.error) && (
        <div className="card card-pad">
          <div className="kicker text-cobalt-500 mb-1">AI answer</div>
          {ai.busy ? <p className="text-sm text-slate-500">Thinking…</p> : ai.error ? <p className="text-sm text-poppy-600">{ai.error}</p> : <p className="text-[14px] text-slate-700 whitespace-pre-wrap leading-relaxed">{ai.text}</p>}
          <p className="hint mt-2">AI answers can be wrong — check them against the matching lines below.</p>
        </div>
      )}

      {submitted && (
        <>
          {res.glossary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {res.glossary.slice(0, 4).map((g) => (
                <div key={g.term} className="rounded-xl bg-cobalt-50/60 border border-cobalt-100 px-4 py-3">
                  <div className="text-sm font-semibold text-cobalt-800">{g.term}</div>
                  <p className="text-[13px] text-slate-600 mt-0.5">{g.plain}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {res.hits.map((h) => (
              <div key={h.name} className="card card-pad">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{h.name}</span>
                  <span className={'pill ' + (h.found.length ? 'bg-teal-50 text-teal-700 ring-teal-200' : 'bg-slate-50 text-slate-400 ring-slate-200')}>
                    {h.found.length ? h.found.length + ' mention' + (h.found.length > 1 ? 's' : '') : 'Not mentioned'}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5 text-[13px] text-slate-600">
                  {h.found.map((f, i) => <li key={i} className="border-l-2 border-cobalt-200 pl-2">{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="hint">“Not mentioned” means the words were not found in the text read from that slip — it may still be covered in the policy wording.</p>
        </>
      )}
    </div>
  );
}

/**
 * Insurance assistant: plain-language summaries of every uploaded proposal,
 * a coverage explainer, document differences, a client recommendation draft
 * and a search across the slips. Runs entirely in the browser from the
 * extracted fields; an optional AI endpoint adds free-form answers.
 */
export default function AssistantView({ proposals }) {
  const [tab, setTab] = useState('summary');
  const allSummaries = () =>
    proposals
      .map((p) => { const s = summarizeProposal(p); return [s.headline, ...s.lines, ...(s.watch.length ? ['Watch out for:', ...s.watch.map((w) => '• ' + w)] : [])].join('\n'); })
      .join('\n\n');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg overflow-x-auto max-w-full">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={'seg-item whitespace-nowrap ' + (tab === t.key ? 'seg-item-active' : '')}>{t.label}</button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
          <span className={'w-1.5 h-1.5 rounded-full ' + (AI_ASSIST_ENDPOINT ? 'bg-teal-500' : 'bg-slate-300')} aria-hidden="true" />
          {AI_ASSIST_ENDPOINT ? 'AI answers on' : 'Built from your slips — nothing leaves the browser'}
        </span>
      </div>

      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => copyText(allSummaries(), 'All summaries')} className="btn btn-secondary btn-sm">Copy all summaries</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {proposals.map((p) => <SummaryCard key={p.id} p={p} />)}
          </div>
        </div>
      )}
      {tab === 'explain' && <ExplainTab proposals={proposals} />}
      {tab === 'diff' && <DiffTab proposals={proposals} />}
      {tab === 'reco' && <RecoTab proposals={proposals} />}
      {tab === 'ask' && <AskTab proposals={proposals} />}

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Generated from the text extracted from each quotation slip. It is a comparison aid, not advice — the policy wording governs, so verify key terms against the original documents.
      </p>
    </div>
  );
}
