import React from 'react';
import howdenLogo from '../assets/howden-logo.gif';

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

const IconOverview = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
  </Icon>
);
const IconBestFit = () => (
  <Icon>
    <line x1="4" y1="6" x2="20" y2="6" />
    <circle cx="14.5" cy="6" r="1.8" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="8.5" cy="12" r="1.8" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="16.5" cy="18" r="1.8" />
  </Icon>
);
const IconMatrix = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 9.5h18M3 15h18M9.5 4v16" />
  </Icon>
);
const IconProposal = () => (
  <Icon>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M15 3v4h4" />
    <path d="M8 13h7M8 16h7M8 10h3" />
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

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', requiresData: true, Icon: IconOverview },
  { key: 'bestfit', label: 'Best Fit', requiresData: true, Icon: IconBestFit },
  { key: 'matrix', label: 'Matrix', requiresData: true, Icon: IconMatrix },
  { key: 'proposal', label: 'Generate a Proposal', requiresData: true, Icon: IconProposal },
  { key: 'doccontrol', label: 'Document Control', requiresData: false, Icon: IconDocControl },
  { key: 'archive', label: 'Archive', requiresData: false, Icon: IconArchive },
];

function NavButton({ item, active, disabled, onClick, compact }) {
  const { Icon: ItemIcon, label } = item;
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Upload proposals first' : label}
      onClick={onClick}
      className={
        'group flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ' +
        (compact ? 'px-3 py-2 shrink-0' : 'w-full px-3 py-2.5') +
        ' ' +
        (disabled
          ? 'text-white/25 cursor-not-allowed'
          : active
          ? 'bg-gradient-to-r from-teal-400 to-cobalt-500 text-white shadow-sm'
          : 'text-cobalt-100/80 hover:bg-white/10 hover:text-white')
      }
    >
      <ItemIcon />
      {!compact && <span className="truncate hidden lg:group-hover/rail:inline">{label}</span>}
      {compact && <span className="truncate text-[13px]">{label}</span>}
    </button>
  );
}

/**
 * Left navigation rail (desktop, lg+) plus a horizontal fallback strip
 * (below lg) — same NAV_ITEMS drive both so the two stay in sync.
 */
export default function Sidebar({ view, setView, hasData, isArchive }) {
  const isActive = (key) => (key === 'archive' ? isArchive : view === key);

  return (
    <>
      {/* Desktop rail — collapses to an icon-only strip and expands on hover so it doesn't permanently take up screen width */}
      <aside className="group/rail hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-16 lg:hover:w-64 bg-cobalt-900 px-3 py-5 z-30 overflow-hidden transition-[width] duration-150 ease-in-out lg:hover:shadow-2xl">
        <div className="flex items-center gap-2.5 px-1.5 mb-6 h-8">
          <div className="hidden lg:group-hover/rail:flex items-center gap-2.5 min-w-0">
            <img src={howdenLogo} alt="Howden" className="h-8 w-auto shrink-0" />
            <div className="min-w-0 border-l border-white/15 pl-2.5 whitespace-nowrap">
              <div className="text-[12px] font-bold uppercase tracking-wide text-teal-400 leading-tight">HowdenPH-Apps</div>
              <div className="text-[11px] text-cobalt-200/80 leading-snug mt-0.5">CRS Comparative Analysis</div>
            </div>
          </div>
          <div className="flex lg:group-hover/rail:hidden items-center justify-center w-8 h-8 rounded-md bg-white/10 text-teal-400 font-bold text-sm shrink-0" aria-hidden="true">H</div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={isActive(item.key)}
              disabled={item.requiresData && !hasData}
              onClick={() => setView(item.key)}
            />
          ))}
        </nav>
        <div className="hidden lg:group-hover/rail:block text-[11px] text-cobalt-200/50 px-1.5 pt-3 border-t border-white/10 whitespace-nowrap">
          Auto-extracted for comparison — always verify against the original slip.
        </div>
      </aside>

      {/* Mobile / narrow-screen strip */}
      <nav className="lg:hidden -mx-4 sm:-mx-6 mb-4 px-4 sm:px-6 py-2 bg-cobalt-900 flex items-center gap-1.5 overflow-x-auto">
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
    </>
  );
}
