// src/components/BrowseFilterSheet.tsx
//
// Slide-up bottom sheet that holds the browse page's filters on phones
// (below the `md` breakpoint). On a narrow screen the desktop filter bar
// wrapped into five or six stacked rows of selects that pushed every
// contractor card below the fold before anyone had chosen anything, so on
// phones the page shows a single "Filters" button instead and the filters
// live in here (KALM-059).
//
// This component owns only the sheet's behaviour, not the filters
// themselves: the browse page passes the SAME filter controls it renders
// in its desktop bar as `children`, driven by the same state, so there is
// one source of truth and the two can never drift apart.
//
// Behaviour a modal sheet needs to be usable with a keyboard or screen
// reader, all handled here:
//   - focus moves into the sheet (the close button) when it opens and
//     goes back to the button that opened it when it closes;
//   - Tab / Shift+Tab stay inside the sheet while it's open;
//   - Escape, the close button, and tapping the backdrop all close it;
//   - the page behind can't scroll while it's open;
//   - it closes itself if the window grows past `md` (rotating a tablet,
//     resizing a browser), since the sheet is hidden there and a hidden
//     modal would otherwise leave the page scroll-locked.
//
// Always mounted rather than rendered only while open, so the slide-in
// and slide-out can animate with plain CSS transitions (no state set in
// an effect to stage a mount animation). While closed it is `invisible`
// and `inert`, which removes it from the tab order and the accessibility
// tree; the visibility transition keeps it visible just long enough for
// the slide-out to finish. Reduced-motion users get no animation
// (globals.css zeroes transition durations for them).

'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BrowseFilterSheet({
  open,
  onClose,
  triggerRef,
  resultCount,
  hasActiveFilters,
  onClearAll,
  children,
}: {
  open: boolean;
  onClose: () => void;
  // The "Filters" button, so focus can return to it on close.
  triggerRef: RefObject<HTMLButtonElement | null>;
  // How many contractors the current filters match, for the
  // "Show N contractors" button.
  resultCount: number;
  hasActiveFilters: boolean;
  onClearAll: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Next frame, so the sheet has already switched from invisible/inert
    // to visible before we try to focus something inside it.
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    const desktop = window.matchMedia('(min-width: 768px)');
    function onBreakpoint(e: MediaQueryListEvent) {
      if (e.matches) onClose();
    }
    desktop.addEventListener('change', onBreakpoint);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpoint);
      trigger?.focus();
    };
  }, [open, onClose, triggerRef]);

  return (
    <div
      className={`md:hidden fixed inset-0 z-50 transition-[visibility] duration-300 ${open ? 'visible' : 'invisible'}`}
      inert={!open}
    >
      {/* Backdrop. Not a button for assistive tech (the close button and
          Escape cover that); it's just a larger tap target for fingers. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-paper text-ink rounded-t-xl shadow-[0_-8px_28px_-8px_rgba(28,30,34,0.2)] transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <h2 id={titleId} className="font-display text-lg">
            Filters
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-md text-stone hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">{children}</div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-line">
          <button
            type="button"
            onClick={onClearAll}
            disabled={!hasActiveFilters}
            className="text-sm px-4 py-3 rounded-md border border-line text-ink disabled:text-stone disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-sm font-medium px-4 py-3 rounded-md bg-ink text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            Show {resultCount} contractor{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
