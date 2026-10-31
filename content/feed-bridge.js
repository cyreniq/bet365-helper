// MAIN world, injected into armed tabs by background.js before the monitor.
// bet365's React event page keeps each market's feed node ("stem") in React props, which
// the isolated-world monitor can't see. This copies what the monitor needs onto the DOM,
// where bet365.js reads it:
//   each market element: data-b365h-title (stem NA), data-b365h-suspended (SU, "1"/"0")
//   <html>: data-b365h-corner-tab, "1" if the event has any market in the Corners/Cards
//           tab (tab id 4 in a market's I2 list), "0" if none, absent if no event found.
// Feed field names are bet365's feed format, not styling, so they outlive page redesigns.
// Recorded from bet365.ee on 2026-10-27, after bet365 replaced the event page.
(() => {
  if (window.__b365hFeedBridge) return;
  window.__b365hFeedBridge = true;

  const ARMED_ATTR = 'data-b365h-armed'; // set by monitor.js
  const MARKET = '[data-market-group-id]';
  const CORNER_TAB_ID = '4';
  // Backup for feed changes that don't touch the DOM (e.g. corner markets dropped from
  // the event while another tab is shown).
  const SWEEP_MS = 1000;

  // The market's MarketGroup component sits 2 fibers above its element (recorded).
  function stemOf(el) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    for (let f = key && el[key], i = 0; f && i < 10; f = f.return, i++) {
      if (f.memoizedProps?.stem) return f.memoizedProps.stem;
    }
    return null;
  }

  // Writes only on change, so stamping doesn't wake the monitor for nothing.
  function setAttr(el, name, value) {
    if (value === null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  function stamp() {
    const root = document.documentElement;
    if (!root.hasAttribute(ARMED_ATTR)) return;
    let event = null;
    for (const el of document.querySelectorAll(MARKET)) {
      const stem = stemOf(el);
      const data = stem?.data;
      setAttr(el, 'data-b365h-title', data?.NA ?? null);
      setAttr(el, 'data-b365h-suspended', data ? (data.SU === '1' ? '1' : '0') : null);
      event ??= stem?.parent ?? null;
    }
    // The event node lists all its markets, rendered or not. An empty list while a market
    // is rendered is the list being rebuilt, not the corner markets being pulled.
    const all = event?._actualChildren;
    const inCornerTab = (m) => String(m.data?.I2 ?? '').split(',').includes(CORNER_TAB_ID);
    setAttr(root, 'data-b365h-corner-tab', all?.length ? (all.some(inCornerTab) ? '1' : '0') : null);
  }

  // React re-renders a market's header when its SU flips, so a class change follows
  // every feed change the monitor cares about; stamp in the same task.
  new MutationObserver(stamp).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', ARMED_ATTR],
  });
  setInterval(stamp, SWEEP_MS);
  stamp();
})();
