// Every bet365-specific selector lives here. Recorded from bet365.ee on 2026-10-11;
// see CLAUDE.md "DOM structure". Update here if bet365 renames classes.
(() => {
  const SEL = {
    grid: '.ipe-EventViewDetail_MarketGrid',
    header: '.sip-MarketGroupButton_TopRowContainer',
    title: '.sip-MarketGroupButton_Text',
    suspendedClass: 'sip-MarketGroupButton-suspended',
  };
  const CORNER_TITLE = /corner/i;

  // Returns [{title, suspended, corner}] for every titled market on the event page.
  function scanMarkets(doc = document) {
    const grid = doc.querySelector(SEL.grid);
    if (!grid) return [];
    const markets = [];
    for (const header of grid.querySelectorAll(SEL.header)) {
      const title = header.querySelector(SEL.title)?.textContent.trim();
      if (!title) continue;
      markets.push({
        title,
        suspended: header.classList.contains(SEL.suspendedClass),
        corner: CORNER_TITLE.test(title),
      });
    }
    return markets;
  }

  const touchesHeaders = (node) =>
    node instanceof Element && (node.matches(SEL.header) || node.querySelector(SEL.header) !== null);

  // True for a header's class changing, or for headers being added/removed (grid re-render).
  function isRelevantMutation(m) {
    if (m.type === 'attributes') return m.target instanceof Element && m.target.matches(SEL.header);
    if (m.type === 'childList') {
      return [...m.addedNodes].some(touchesHeaders) || [...m.removedNodes].some(touchesHeaders);
    }
    return false;
  }

  globalThis.B365H_bet365 = { SEL, scanMarkets, isRelevantMutation };
})();
