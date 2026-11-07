// Reads the bet365 state that feed-bridge.js (MAIN world) copies from bet365's feed data
// onto <html>. bet365 replaced the event page on 2026-10-27 with a React app whose class
// names are build hashes, so nothing here depends on its markup. See CLAUDE.md
// "DOM structure".
(() => {
  // Written by feed-bridge.js.
  const ATTR = {
    markets: 'data-b365h-markets',
    cornerTab: 'data-b365h-corner-tab',
    stale: 'data-b365h-stale',
  };
  const CORNER_TITLE = /corner/i;

  // Returns [{title, suspended, corner}] for every market of the open event, including
  // markets not rendered on the selected market tab. Empty if no event was found.
  function scanMarkets(doc = document) {
    let list;
    try {
      list = JSON.parse(doc.documentElement.getAttribute(ATTR.markets) ?? '[]');
    } catch {
      return [];
    }
    return list.map(([title, suspended]) => ({
      title,
      suspended: suspended === 1,
      corner: CORNER_TITLE.test(title),
    }));
  }

  // True if the Corners/Cards tab is shown, false if bet365 hid it, null if unknown
  // (not an event page, or mid re-render). bet365 hides the tab exactly when the event
  // has no market in it (survey of 61 events, 2026-10-25).
  function cornerTabShown(doc = document) {
    const value = doc.documentElement.getAttribute(ATTR.cornerTab);
    return value === null ? null : value === '1';
  }

  // null while the page's live connection is fine; otherwise "reconnecting" or "reload".
  function staleState(doc = document) {
    return doc.documentElement.getAttribute(ATTR.stale);
  }

  // Removes everything feed-bridge.js stamped. Stamps stop updating while a tab isn't
  // armed, so left in place they'd be taken for the current state when it's armed again.
  function clearStamps(doc = document) {
    for (const name of Object.values(ATTR)) doc.documentElement.removeAttribute(name);
  }

  globalThis.B365H_bet365 = { ATTR, scanMarkets, cornerTabShown, staleState, clearStamps };
})();
