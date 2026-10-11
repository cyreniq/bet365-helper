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
  };

  function initialState() {
    return { prev: new Map(), fullActive: false, fullEndedAt: -Infinity };
  }

  // state.prev maps market title -> suspended at the previous scan. Titles never seen
  // before (first scan, re-render, tab switch) can't count as "newly suspended", so
  // markets that are already grey when they appear never alert.
  function classify(state, markets, opts = {}) {
    const { fullThreshold, minNonCornerForFull, fullExitThreshold, cornerQuietAfterFullMs, now = Date.now() } =
      { ...DEFAULTS, ...opts };

    const newly = markets.filter((m) => m.suspended && state.prev.get(m.title) === false);
    const nonCorner = markets.filter((m) => !m.corner);
    const suspendedNonCorner = nonCorner.filter((m) => m.suspended).length;
    const suspendedShare = markets.length ? markets.filter((m) => m.suspended).length / markets.length : 0;
    const isFull =
      nonCorner.length >= minNonCornerForFull && suspendedNonCorner / nonCorner.length >= fullThreshold;

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
    } else if (newly.some((m) => m.corner) && now - fullEndedAt >= cornerQuietAfterFullMs) {
      alert = 'corner';
    }

    // Keep titles that are temporarily missing (mid re-render) so their state carries over.
    const prev = new Map(state.prev);
    for (const m of markets) prev.set(m.title, m.suspended);

    return { alert, state: { prev, fullActive, fullEndedAt } };
  }

  const api = { DEFAULTS, initialState, classify };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.B365H_classify = api;
})();
