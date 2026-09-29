// src/components/ProfileQuoteBar.tsx
//
// Mobile-only sticky "Request a quote" bar for the contractor profile
// (KALM-060). Below the lg breakpoint the page is one column and the quote
// form sits in the sidebar, which ends up underneath every project card,
// so on a phone the main call to action was a long scroll away. This bar
// stays pinned to the bottom of the screen and jumps to the form.
//
// The page decides WHEN to render it (not for contractor viewers, not
// while the session is loading, not after a request is sent) and what the
// tap does (scroll to the form and focus it, or to the sign-up prompt for
// a logged-out visitor). It is hidden at lg and up, where the form is
// already on screen in the sticky sidebar.
//
// The bar is position: fixed, so it would permanently cover whatever is at
// the very bottom of the page (the end of the footer). <ProfileQuoteBarSpacer>
// adds exactly that much empty space after the footer on mobile. The two
// style constants below sit side by side so they're changed together; both
// also add
// env(safe-area-inset-bottom) so the button clears the iPhone home
// indicator (needs viewport-fit=cover to be non-zero; harmless otherwise).

// Bar = 12px top padding + 44px button + 12px bottom padding + 1px border.
// Spacer uses the same value plus the safe-area inset.
const BAR_STYLE = { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } as const;
const SPACER_STYLE = { height: 'calc(69px + env(safe-area-inset-bottom))' } as const;

export default function ProfileQuoteBar({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-paper/95 backdrop-blur-sm border-t border-line px-4 pt-3"
      style={BAR_STYLE}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full h-11 bg-ink text-paper font-medium text-sm rounded-full hover:bg-stone transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        Request a quote
      </button>
    </div>
  );
}

export function ProfileQuoteBarSpacer() {
  return <div aria-hidden="true" className="lg:hidden" style={SPACER_STYLE} />;
}
