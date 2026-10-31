// Visual alert (isolated world): flashes the dark panel around the live match graphic
// (pitch/stats/timeline) in the alert's colour. That panel's class names are readable
// (`lv-…`, `ml1-…`), not the build hashes of the market grid, so it's found by class.
// If bet365 renames it, flash() does nothing and the sound still plays.
(() => {
  if (globalThis.B365H_flash) return;

  const PANEL = '.lv-LiveTabView';
  const COLORS = {
    full: 'rgb(220, 30, 30)',
    corner: 'rgb(240, 200, 0)',
    removed: 'rgb(245, 120, 0)',
    ending: 'rgb(40, 110, 240)',
  };
  const FLASHES = 3;
  const FLASH_MS = 500;

  function flash(kind) {
    const panel = document.querySelector(PANEL);
    if (!panel || !COLORS[kind]) return false;
    // Without a fill the animation ends on the panel's own background.
    const base = getComputedStyle(panel).backgroundColor;
    panel.animate(
      [{ backgroundColor: base }, { backgroundColor: COLORS[kind] }, { backgroundColor: base }],
      { duration: FLASH_MS, iterations: FLASHES, easing: 'ease-in-out' },
    );
    return true;
  }

  globalThis.B365H_flash = flash;
})();
