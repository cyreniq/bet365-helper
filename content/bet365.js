// Every bet365-specific selector lives here. bet365 replaced the event page on
// 2026-10-27 with a React app whose class names are build hashes, so market state is
// read from attributes that feed-bridge.js (MAIN world) copies from bet365's feed data.
// See CLAUDE.md "DOM structure".
(() => {
  const SEL = {
    // Each rendered market; the value is bet365's market type id.
    market: '[data-market-group-id]',
  };
  // Written by feed-bridge.js.
  const ATTR = {
    title: 'data-b365h-title',
    suspended: 'data-b365h-suspended',
    cornerTab: 'data-b365h-corner-tab',
  };
  const CORNER_TITLE = /corner/i;

  // Returns [{title, suspended, corner}] for every titled market on the event page.
  function scanMarkets(doc = document) {
    const markets = [];
    for (const el of doc.querySelectorAll(SEL.market)) {
      const title = el.getAttribute(ATTR.title)?.trim();
      if (!title) continue;
      markets.push({
        title,
        suspended: el.getAttribute(ATTR.suspended) === '1',
        corner: CORNER_TITLE.test(title),
      });
    }
    return markets;
  }

  // True if the Corners/Cards tab is shown, false if bet365 hid it, null if unknown
  // (not an event page, or mid re-render). bet365 hides the tab exactly when the event
  // has no market in it (survey of 61 events, 2026-10-25).
  function cornerTabShown(doc = document) {
    const value = doc.documentElement.getAttribute(ATTR.cornerTab);
    return value === null ? null : value === '1';
  }

  // Removes everything feed-bridge.js stamped. Stamps stop updating while a tab isn't
  // armed, so left in place they'd be taken for the current state when it's armed again.
  function clearStamps(doc = document) {
    doc.documentElement.removeAttribute(ATTR.cornerTab);
    for (const el of doc.querySelectorAll(SEL.market)) {
      el.removeAttribute(ATTR.title);
      el.removeAttribute(ATTR.suspended);
    }
  }

  const touchesMarket = (node) =>
    node instanceof Element && (node.matches(SEL.market) || node.querySelector(SEL.market) !== null);

  // True for a market's or the corner tab's stamped state changing, or for markets being
  // added/removed (grid re-render, markets pulled).
  function isRelevantMutation(m) {
    if (m.type === 'attributes') return Object.values(ATTR).includes(m.attributeName);
    if (m.type === 'childList') {
      return [...m.addedNodes].some(touchesMarket) || [...m.removedNodes].some(touchesMarket);
    }
    return false;
  }

  globalThis.B365H_bet365 = { SEL, ATTR, scanMarkets, cornerTabShown, clearStamps, isRelevantMutation };
})();
