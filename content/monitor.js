// Isolated-world monitor, injected into armed tabs after bet365.js and classify.js.
// Re-injection on an already-monitored page just restarts it.
(() => {
  if (globalThis.__b365hMonitor) {
    globalThis.__b365hMonitor.start();
    return;
  }

  const { scanMarkets, isRelevantMutation } = globalThis.B365H_bet365;
  const { initialState, classify } = globalThis.B365H_classify;

  const ARMED_ATTR = 'data-b365h-armed'; // read by raf-shim.js in the MAIN world
  // One closure flips many headers within a few ms; evaluate once after the burst.
  const SETTLE_MS = 250;
  const COOLDOWN_MS = 2000;

  let state = initialState();
  let observer = null;
  let timer = null;
  const lastAlertAt = { corner: 0, full: 0 };

  function evaluate() {
    timer = null;
    const result = classify(state, scanMarkets());
    state = result.state;
    if (!result.alert) return;
    const now = Date.now();
    if (now - lastAlertAt[result.alert] < COOLDOWN_MS) return;
    lastAlertAt[result.alert] = now;
    console.debug('[bet365-helper] closure:', result.alert);
    chrome.runtime.sendMessage({ type: 'closure', kind: result.alert }).catch(() => {});
  }

  function onMutations(mutations) {
    if (timer || !mutations.some(isRelevantMutation)) return;
    timer = setTimeout(evaluate, SETTLE_MS);
  }

  // A different event has different markets; start fresh so nothing alerts on arrival.
  function onHashChange() {
    state = initialState();
    evaluate();
  }

  function start() {
    stop();
    document.documentElement.setAttribute(ARMED_ATTR, '');
    state = initialState();
    // Observe body, not the grid: bet365 replaces the grid element mid-match.
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    window.addEventListener('hashchange', onHashChange);
    evaluate(); // baseline scan; can't alert because every title is new
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    clearTimeout(timer);
    timer = null;
    window.removeEventListener('hashchange', onHashChange);
    document.documentElement.removeAttribute(ARMED_ATTR);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'stop') stop();
  });

  globalThis.__b365hMonitor = { start, stop };
  start();
})();
