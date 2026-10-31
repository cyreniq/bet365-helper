// MAIN world, document_start on bet365 pages.
// Chrome pauses requestAnimationFrame in hidden tabs, and bet365 appears to stop
// rendering market changes while hidden. While the tab is armed (attribute set by
// monitor.js), every rAF callback also gets a timeout fallback so rendering keeps
// going in the background. Unarmed tabs use native rAF only (the timeout is skipped).
// Experimental: unverified that this is what blocks bet365's updates.
(() => {
  if (window.__b365hRafShim) return;
  window.__b365hRafShim = true;

  const ARMED_ATTR = 'data-b365h-armed';
  const FALLBACK_MS = 100;
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const pending = new Map();
  let nextId = 1e9; // stay clear of native ids issued before the shim loaded

  window.requestAnimationFrame = function requestAnimationFrame(cb) {
    const id = nextId++;
    const run = (ts) => {
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      nativeCancel(p.raf);
      clearTimeout(p.timer);
      cb(typeof ts === 'number' ? ts : performance.now());
    };
    const armed = document.documentElement?.hasAttribute(ARMED_ATTR);
    pending.set(id, {
      raf: nativeRaf(run),
      timer: armed ? setTimeout(run, FALLBACK_MS) : undefined,
    });
    return id;
  };

  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    const p = pending.get(id);
    if (!p) return nativeCancel(id);
    pending.delete(id);
    nativeCancel(p.raf);
    clearTimeout(p.timer);
  };
})();
