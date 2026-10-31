// Pure closure classification, no DOM or chrome APIs (unit-tested with node --test).
(() => {
  const DEFAULTS = {
    // Full closure starts when at least this share of rendered non-corner markets is suspended.
    fullThreshold: 0.75,
    // Below this many rendered non-corner markets, full closure can't be told apart.
    minNonCornerForFull: 3,
    // A full closure only ends once fewer than this share of all markets is still
    // suspended. bet365 reopens markets in stages after a goal; without this
    // hysteresis the closure "ended" halfway through and corner flicker alerted.
    fullExitThreshold: 0.25,
    // No corner alerts for this long after a full closure ends.
    cornerQuietAfterFullMs: 10000,
    // Match ending: an event that showed at least endingMinPeak markets is down to at most
    // endingMaxLeft, all suspended.
    endingMinPeak: 4,
    endingMaxLeft: 2,
  };

  function initialState() {
    return {
      prev: new Map(),
      fullActive: false,
      fullEndedAt: -Infinity,
      cornerTab: null,
      // Most markets rendered in one scan, and the count of the last non-empty scan.
      peakCount: 0,
      lastCount: 0,
      endingFired: false,
    };
  }

  // state.prev maps market title -> suspended at the previous scan. Titles never seen
  // before (first scan, re-render, tab switch) can't count as "newly suspended", so
  // markets that are already grey when they appear never alert.
  //
  // opts.cornerTab is whether the Corners/Cards tab is shown (true/false, null if absent).
  // Late in a match bet365 pulls the corner markets without greying them and hides that
  // tab, so the tab going from shown to hidden alerts 'removed'. Unlike missing markets it
  // doesn't depend on which tab the user is viewing.
  //
  // Shortly before full time bet365 removes the open markets one by one until a single one
  // is left, then suspends that one too ('ending', once per event). Removed markets just
  // vanish from the scan, so this is told by the market count dropping, not by greying.
  function classify(state, markets, opts = {}) {
    const {
      fullThreshold,
      minNonCornerForFull,
      fullExitThreshold,
      cornerQuietAfterFullMs,
      endingMinPeak,
      endingMaxLeft,
      now = Date.now(),
      cornerTab = null,
    } = { ...DEFAULTS, ...opts };

    const newly = markets.filter((m) => m.suspended && state.prev.get(m.title) === false);
    const cornerTabHidden = state.cornerTab === true && cornerTab === false;
    const nonCorner = markets.filter((m) => !m.corner);
    const suspendedNonCorner = nonCorner.filter((m) => m.suspended).length;
    const suspendedShare = markets.length ? markets.filter((m) => m.suspended).length / markets.length : 0;
    const isFull =
      nonCorner.length >= minNonCornerForFull && suspendedNonCorner / nonCorner.length >= fullThreshold;

    // The last markets closing now, or the others vanishing around already-closed ones.
    // Needs the event to have shown more markets before, so arriving at a page that is
    // already down to one closed market stays silent.
    const isEnding =
      !state.endingFired &&
      state.peakCount >= endingMinPeak &&
      markets.length > 0 &&
      markets.length <= endingMaxLeft &&
      markets.every((m) => m.suspended) &&
      (newly.length > 0 || markets.length < state.lastCount);

    let alert = null;
    let { fullActive, fullEndedAt } = state;
    if (fullActive) {
      // An empty scan is a mid re-render, not a reopening.
      if (markets.length && suspendedShare < fullExitThreshold) {
        fullActive = false;
        fullEndedAt = now;
      }
    } else if (isFull) {
      fullActive = true;
      if (newly.length > 0) alert = 'full';
    } else if (now - fullEndedAt >= cornerQuietAfterFullMs) {
      if (cornerTabHidden) alert = 'removed';
      else if (newly.some((m) => m.corner)) alert = 'corner';
    }
    // Overrides the others, even during a full closure (a late goal).
    if (isEnding) alert = 'ending';

    // Keep titles that are temporarily missing (mid re-render) so their state carries over.
    const prev = new Map(state.prev);
    for (const m of markets) prev.set(m.title, m.suspended);

    // An absent tab (mid re-render) keeps the last known state, like missing titles.
    return {
      alert,
      state: {
        prev,
        fullActive,
        fullEndedAt,
        cornerTab: cornerTab ?? state.cornerTab,
        peakCount: Math.max(state.peakCount, markets.length),
        lastCount: markets.length || state.lastCount,
        endingFired: state.endingFired || isEnding,
      },
    };
  }

  const api = { DEFAULTS, initialState, classify };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.B365H_classify = api;
})();
