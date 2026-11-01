import React from 'react';
import howdenLogo from '../assets/Howden Logo cobalt blue.png';

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

const IconOverview = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
);
const IconBestFit = () => (
  <Icon>
    <path d="M4 20h16" />
    <path d="M7 16v-5M12 16V6M17 16v-8" />
  </Icon>
);
const IconMatrix = () => (
  <Icon>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M9.5 4v16" />
  </Icon>
);
const IconProposal = () => (
  <Icon>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M15 3v4h4" />
    <path d="m9 14 2 2 4-4" />
  </Icon>
);
const IconDocControl = () => (
  <Icon>
    <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6l1.8 2H18.8A2.2 2.2 0 0 1 21 9.2v7.6A2.2 2.2 0 0 1 18.8 19H5.2A2.2 2.2 0 0 1 3 16.8V7.2Z" />
  </Icon>
);
const IconArchive = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v9.2A1.8 1.8 0 0 0 6.8 19h10.4A1.8 1.8 0 0 0 19 17.2V8" />
    <path d="M10 13h4" />
  </Icon>
);

const NAV_GROUPS = [
  {
    label: 'Compare',
    items: [
      { key: 'overview', label: 'Overview', requiresData: false, Icon: IconOverview },
      { key: 'bestfit', label: 'Best Fit', requiresData: true, Icon: IconBestFit },
      { key: 'matrix', label: 'Matrix', requiresData: true, Icon: IconMatrix },
      { key: 'proposal', label: 'Proposal', requiresData: true, Icon: IconProposal },
    ],
  },
  {
    label: 'Library',
    items: [
      { key: 'doccontrol', label: 'Document Control', requiresData: false, Icon: IconDocControl },
      { key: 'archive', label: 'Archive', requiresData: false, Icon: IconArchive },
    ],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function NavButton({ item, active, disabled, onClick, compact }) {
  const { Icon: ItemIcon, label } = item;
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Upload proposals first' : label}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        'relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ' +
        (compact ? 'px-3 py-1.5 shrink-0' : 'w-full px-3 py-2') +
        ' ' +
        (disabled
          ? 'text-slate-300 cursor-not-allowed'
          : active
          ? 'bg-cobalt-50 text-cobalt-600'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
      }
    >
      {!compact && active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-cobalt-500" aria-hidden="true" />}
      <ItemIcon />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Left navigation (desktop, lg+) plus a sticky top bar with a horizontal
 * strip (below lg) — the same NAV_GROUPS drive both so the two stay in sync.
 */
export default function Sidebar({ view, setView, hasData, isArchive }) {
  const isActive = (key) => (key === 'archive' ? isArchive : view === key);
  const go = (key) => setView(key);

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-white border-r border-slate-200/80 z-30">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
          <img src={howdenLogo} alt="Howden" className="h-7 w-auto shrink-0" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavButton
                    key={item.key}
                    item={item}
                    active={isActive(item.key)}
                    disabled={item.requiresData && !hasData}
                    onClick={() => go(item.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="m-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" aria-hidden="true" />
            Processed in your browser
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Auto-extracted for comparison — always verify against the original slip.
          </p>
        </div>
      </aside>

      {/* Mobile / narrow-screen top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200/80">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
          <img src={howdenLogo} alt="Howden" className="h-6 w-auto shrink-0" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-3 sm:px-5 pb-2">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={isActive(item.key)}
              disabled={item.requiresData && !hasData}
              onClick={() => setView(item.key)}
              compact
            />
          ))}
        </nav>
      </div>
    </>
  );
}
