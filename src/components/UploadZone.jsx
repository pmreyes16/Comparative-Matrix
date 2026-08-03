import React, { useRef } from 'react';

export default function UploadZone({ onFiles }) {
  const dropRef = useRef();
  return (
    <div
      ref={dropRef}
      onDragOver={(e) => {
        e.preventDefault();
        dropRef.current.classList.add('border-cobalt-400');
      }}
      onDragLeave={() => dropRef.current.classList.remove('border-cobalt-400')}
      onDrop={(e) => {
        e.preventDefault();
        dropRef.current.classList.remove('border-cobalt-400');
        if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
      }}
      className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-6 text-center transition mb-4"
    >
      <p className="text-slate-600 text-sm">Drag &amp; drop proposal files here, or</p>
      <label className="inline-block mt-2 cursor-pointer rounded-lg bg-cobalt-600 text-white px-4 py-2 text-sm font-medium hover:bg-cobalt-700 transition-colors">
        Choose files
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
      </label>
      <p className="mt-2 text-[11px] text-slate-400">
        PDF, Excel (.xlsx/.xls) and Word (.docx). Everything is parsed in your browser — nothing is uploaded to a server.
      </p>
    </div>
  );
}
