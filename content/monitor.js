// Isolated-world monitor, injected into armed tabs after bet365.js, classify.js,
// player.js and flash.js.
// Re-injection on an already-monitored page just restarts it.
(() => {
  if (globalThis.__b365hMonitor) {
    globalThis.__b365hMonitor.start();
    return;
  }

  const { ATTR, scanMarkets, cornerTabShown, clearStamps, isRelevantMutation } = globalThis.B365H_bet365;
  const { initialState, classify } = globalThis.B365H_classify;
  const player = globalThis.B365H_player;
  const flash = globalThis.B365H_flash;

  const ARMED_ATTR = 'data-b365h-armed'; // read by raf-shim.js in the MAIN world
  // One closure flips many headers within a few ms (recorded: 8 corner markets
  // within a few ms); evaluate once after the burst.
  const SETTLE_MS = 100;
  const COOLDOWN_MS = 2000;
  // Badge status check; also the flash rate while the page can't play audio itself.
  const TICK_MS = 500;
  // No markets for this long shows "?". Covers a mid-match re-render without flicker.
  const MISSING_AFTER_MS = 5000;
  // The page keeps showing the previous event for a moment after a hash change.
  const NEW_EVENT_SETTLE_MS = 3000;

  let state = initialState();
  let settleUntil = 0;
  let observer = null;
  let timer = null;
  const lastAlertAt = { corner: 0, full: 0, removed: 0, ending: 0 };

  let tickTimer = null;
  let lastLook = null;
  let marketsSeenAt = 0;
  let flashPhase = false;

  let lastLogged = '';

  // One console line per change in what's suspended, to diagnose misclassified closures.
  function log(markets, result) {
    const closed = markets.filter((m) => m.suspended);
    const corners = closed.filter((m) => m.corner).length;
    const line =
      `suspended ${closed.length}/${markets.length} ` +
      `(corner ${corners}/${markets.filter((m) => m.corner).length}) ` +
      `full=${result.state.fullActive} cornerTab=${result.state.cornerTab}` +
      (result.alert ? ` ALERT=${result.alert}` : '');
    if (line === lastLogged) return;
    lastLogged = line;
    console.log(`[bet365-helper] ${new Date().toLocaleTimeString()} ${line}`, closed.map((m) => m.title));
  }

  // After the extension is reloaded, this copy keeps running in the page until the
  // tab reloads, and sendMessage then throws "Extension context invalidated".
  function send(msg) {
    if (!chrome.runtime?.id) {
      stop();
      return;
    }
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  function evaluate() {
    timer = null;
    // Each scan while settling is a new baseline, so the previous event never counts.
    if (Date.now() < settleUntil) state = initialState();
    const markets = scanMarkets();
    const result = classify(state, markets, { cornerTab: cornerTabShown() });
    state = result.state;
    log(markets, result);
    if (!result.alert) return;
    const now = Date.now();
    if (now - lastAlertAt[result.alert] < COOLDOWN_MS) return;
    lastAlertAt[result.alert] = now;
    // Played in-page when the page allows audio; otherwise the background plays it.
    const playedHere = player.play(result.alert);
    send({ type: 'closure', kind: result.alert, playedHere });
    flash(result.alert);
  }

  // Picks the toolbar badge (looks in background.js) and reports it when it changes.
  function tick() {
    if (!chrome.runtime?.id) {
      stop();
      return;
    }
    // An old copy shutting down (see send) removes this, which would stop feed-bridge.js.
    if (!document.documentElement.hasAttribute(ARMED_ATTR)) {
      document.documentElement.setAttribute(ARMED_ATTR, '');
    }
    const now = Date.now();
    if (scanMarkets().length) marketsSeenAt = now;
    flashPhase = !flashPhase;
    let look = 'on';
    if (now - marketsSeenAt >= MISSING_AFTER_MS) look = flashPhase ? 'missingAlt' : 'missing';
    else if (!player.ready()) look = flashPhase ? 'onAlt' : 'on';
    if (look === lastLook) return;
    lastLook = look;
    send({ type: 'badge', look });
  }

  function onMutations(mutations) {
    if (timer || !mutations.some(isRelevantMutation)) return;
    timer = setTimeout(evaluate, SETTLE_MS);
  }

  // A different event has different markets; start fresh so nothing alerts on arrival.
  function onHashChange() {
    settleUntil = Date.now() + NEW_EVENT_SETTLE_MS;
    evaluate();
  }

  function start() {
    stop();
    clearStamps();
    document.documentElement.setAttribute(ARMED_ATTR, '');
    state = initialState();
    // Observe the whole document: bet365 replaces the grid element mid-match, and the
    // corner tab state is stamped on <html>.
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: Object.values(ATTR),
    });
    window.addEventListener('hashchange', onHashChange);
    evaluate(); // baseline scan; can't alert because every title is new
    marketsSeenAt = Date.now();
    lastLook = null;
    tickTimer = setInterval(tick, TICK_MS);
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    clearTimeout(timer);
    timer = null;
    clearInterval(tickTimer);
    tickTimer = null;
    window.removeEventListener('hashchange', onHashChange);
    document.documentElement.removeAttribute(ARMED_ATTR);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'stop') stop();
  });

  globalThis.__b365hMonitor = { start, stop };
  start();
})();
