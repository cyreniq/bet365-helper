// Pure closure classification, no DOM or chrome APIs (unit-tested with node --test).
(() => {
  const DEFAULTS = {
    // Full closure = at least this share of rendered non-corner markets suspended.
    fullThreshold: 0.75,
    // Below this many rendered non-corner markets, full closure can't be told apart.
    minNonCornerForFull: 3,
  };

  function initialState() {
    return { prev: new Map(), fullActive: false };
  }

  // state.prev maps market title -> suspended at the previous scan. Titles never seen
  // before (first scan, re-render, tab switch) can't count as "newly suspended", so
  // markets that are already grey when they appear never alert.
  function classify(state, markets, opts = {}) {
    const { fullThreshold, minNonCornerForFull } = { ...DEFAULTS, ...opts };

    const newly = markets.filter((m) => m.suspended && state.prev.get(m.title) === false);
    const nonCorner = markets.filter((m) => !m.corner);
    const suspendedNonCorner = nonCorner.filter((m) => m.suspended).length;
    const isFull =
      nonCorner.length >= minNonCornerForFull && suspendedNonCorner / nonCorner.length >= fullThreshold;

    let alert = null;
    if (!state.fullActive && newly.length > 0) {
      if (isFull) alert = 'full';
      else if (newly.some((m) => m.corner)) alert = 'corner';
    }

    // Keep titles that are temporarily missing (mid re-render) so their state carries over.
    const prev = new Map(state.prev);
    for (const m of markets) prev.set(m.title, m.suspended);

    return { alert, state: { prev, fullActive: isFull } };
  }

  const api = { DEFAULTS, initialState, classify };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.B365H_classify = api;
})();
