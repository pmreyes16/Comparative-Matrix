import React, { useRef } from 'react';

const ACTIVE = ['border-cobalt-400', 'bg-cobalt-50/60'];

function UploadIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </svg>
  );
}

/** Drop target for quotation slips. `compact` renders a one-line bar once proposals exist. */
export default function UploadZone({ onFiles, compact }) {
  const dropRef = useRef();
  const input = (
    <input
      type="file"
      multiple
      accept=".pdf,.xlsx,.xls,.docx"
      className="hidden"
      onChange={(e) => {
        onFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );
  return (
    <div
      ref={dropRef}
      onDragOver={(e) => {
        e.preventDefault();
        dropRef.current.classList.add(...ACTIVE);
      }}
      onDragLeave={() => dropRef.current.classList.remove(...ACTIVE)}
      onDrop={(e) => {
        e.preventDefault();
        dropRef.current.classList.remove(...ACTIVE);
        if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
      }}
      className={
        'rounded-2xl border-2 border-dashed border-slate-300 bg-white transition-colors mb-5 ' +
        (compact ? 'px-4 py-3 flex flex-wrap items-center gap-3' : 'px-6 py-10 text-center')
      }
    >
      {compact ? (
        <>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-cobalt-50 text-cobalt-500 shrink-0">
            <UploadIcon className="w-[18px] h-[18px]" />
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-medium text-slate-700">Add more quotation slips</div>
            <div className="hint">Drop files here — PDF, Excel or Word. Parsed in your browser.</div>
          </div>
          <label className="btn btn-secondary btn-sm cursor-pointer">
            Choose files
            {input}
          </label>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt-500">
            <UploadIcon className="w-6 h-6" />
          </div>
          <p className="text-[15px] font-semibold text-slate-800">Drop quotation slips here</p>
          <p className="text-sm text-slate-500 mt-0.5">or choose them from your computer</p>
          <label className="btn btn-primary mt-4 cursor-pointer">
            Choose files
            {input}
          </label>
          <p className="mt-4 hint">
            PDF, Excel (.xlsx/.xls) and Word (.docx). Everything is parsed in your browser — nothing is uploaded to a server.
          </p>
        </>
      )}
    </div>
  );
}
