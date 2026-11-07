// MAIN world, injected into armed tabs by background.js before the monitor.
// bet365's React event page keeps its feed data in React props and in its own globals,
// which the isolated-world monitor can't see. This copies what the monitor needs onto
// <html>, where bet365.js reads it:
//   data-b365h-markets:     JSON [[title, suspended 0/1], ...] for every market of the
//                           open event, rendered or not (absent if no event found)
//   data-b365h-corner-tab:  "1" if the event has any market in the Corners/Cards tab
//                           (tab id 4 in a market's I2 list), "0" if none, absent if unknown
//   data-b365h-stale:       set while the page's live connection has gone quiet:
//                           "reconnecting" (we closed it so bet365 reconnects), then
//                           "reload" if that didn't help (background.js reloads the tab)
// Feed field names are bet365's feed format, not styling, so they outlive page redesigns.
// Recorded from bet365.ee on 2026-10-27 and 2026-11-07. See CLAUDE.md "DOM structure".
(() => {
  if (window.__b365hFeedBridge) return;
  window.__b365hFeedBridge = true;

  const ARMED_ATTR = 'data-b365h-armed'; // set by monitor.js
  const MARKET = '[data-market-group-id]';
  const CORNER_TAB_ID = '4';
  const ATTR = {
    markets: 'data-b365h-markets',
    cornerTab: 'data-b365h-corner-tab',
    stale: 'data-b365h-stale',
  };
  // Backup for feed changes we don't get a socket message or DOM change for.
  const SWEEP_MS = 1000;
  // The page's connection normally gets a message every ~0.5 s. bet365 replaces a quiet
  // connection itself after ~10 s, and reconnecting took ~14 s (recorded 2026-11-07), so
  // only a longer silence counts as stale.
  const QUIET_MS = 30000;
  // After closing the connection, how long bet365 gets to reconnect before a reload.
  const RECONNECT_GRACE_MS = 30000;

  const log = (...args) => console.log(`[bet365-helper] ${new Date().toLocaleTimeString()}`, ...args);

  // The market's MarketGroup component sits 2 fibers above its element (recorded).
  function stemOf(el) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    for (let f = key && el[key], i = 0; f && i < 10; f = f.return, i++) {
      if (f.memoizedProps?.stem) return f.memoizedProps.stem;
    }
    return null;
  }

  function setAttr(el, name, value) {
    if (value === null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  // The open event's feed node (EV). Found via a rendered market; kept while none is
  // rendered (tab switch, re-render) as long as the URL still names the same event.
  let event = null;
  let eventHash = null;
  function findEvent() {
    for (const el of document.querySelectorAll(MARKET)) {
      const ev = stemOf(el)?.parent;
      if (ev) {
        event = ev;
        eventHash = location.hash;
        return ev;
      }
    }
    return eventHash === location.hash ? event : null;
  }

  function stamp() {
    const root = document.documentElement;
    if (!root.hasAttribute(ARMED_ATTR)) return;
    // The event node lists all its markets, rendered or not. An empty list is the list
    // being rebuilt; leave the last stamp so it isn't taken for the markets being pulled.
    const ev = findEvent();
    if (!ev) {
      setAttr(root, ATTR.markets, null);
      setAttr(root, ATTR.cornerTab, null);
      return;
    }
    const all = (ev._actualChildren ?? []).filter((m) => m.data?.NA);
    if (!all.length) return;
    setAttr(root, ATTR.markets, JSON.stringify(all.map((m) => [m.data.NA, m.data.SU === '1' ? 1 : 0])));
    const inCornerTab = (m) => String(m.data.I2 ?? '').split(',').includes(CORNER_TAB_ID);
    setAttr(root, ATTR.cornerTab, all.some(inCornerTab) ? '1' : '0');
  }

  // Coalesces a burst of triggers into one stamp, after bet365 has applied the message
  // (its own socket listener was added first, so it runs first).
  let stampQueued = false;
  function queueStamp() {
    if (stampQueued) return;
    stampQueued = true;
    setTimeout(() => {
      stampQueued = false;
      stamp();
    }, 0);
  }

  // --- Live connection watch ---
  // bet365's push connection (internal names, recorded 2026-11-07). If they're gone the
  // watch does nothing, so a bet365 change can't cause reloads.
  const transport = () =>
    window.Locator?.subscriptionManager?._streamDataProcessor?._serverConnection?._currentTransportMethod;

  let socket = null;
  let lastMessageAt = Date.now();
  let closedAt = 0; // when we closed the connection to make bet365 reconnect

  function onMessage() {
    lastMessageAt = Date.now();
    queueStamp();
  }

  function watchConnection() {
    const root = document.documentElement;
    if (!root.hasAttribute(ARMED_ATTR)) {
      closedAt = 0;
      setAttr(root, ATTR.stale, null);
      return;
    }
    const s = transport()?._socket;
    if (s && s !== socket) {
      socket?.removeEventListener('message', onMessage);
      socket = s;
      s.addEventListener('message', onMessage);
      // bet365 replaced its connection; give the new one a full quiet period.
      lastMessageAt = Date.now();
    }
    if (!socket) return;
    const now = Date.now();
    const quiet = now - lastMessageAt;
    if (quiet < QUIET_MS) {
      if (root.hasAttribute(ATTR.stale)) log(`live connection is back (${root.getAttribute(ATTR.stale)})`);
      closedAt = 0;
      setAttr(root, ATTR.stale, null);
      return;
    }
    if (!closedAt) {
      closedAt = now;
      log(`live connection quiet for ${Math.round(quiet / 1000)} s; closing it so bet365 reconnects`);
      setAttr(root, ATTR.stale, 'reconnecting');
      try {
        socket.close();
      } catch (err) {
        log('could not close the live connection', err);
      }
    } else if (now - closedAt >= RECONNECT_GRACE_MS && root.getAttribute(ATTR.stale) !== 'reload') {
      log(`bet365 didn't reconnect within ${RECONNECT_GRACE_MS / 1000} s; asking for a reload`);
      setAttr(root, ATTR.stale, 'reload');
    }
  }

  function sweep() {
    stamp();
    watchConnection();
  }

  // React re-renders a rendered market's header when its SU flips; stamp in the same task.
  new MutationObserver(stamp).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', ARMED_ATTR],
  });
  setInterval(sweep, SWEEP_MS);
  sweep();
})();
