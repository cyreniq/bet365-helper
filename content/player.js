// In-page alert playback (isolated world). Sounds are decoded once up front, so an
// alert starts within milliseconds. This is the fast path: the offscreen document
// (background.js) is the fallback, because Chrome closes it after 30 s of silence
// and re-creating it costs ~100-300 ms per alert.
//
// The page's autoplay policy applies here: the AudioContext only runs once the user
// has interacted with the bet365 page (click, key press), and it's lost again after a
// reload. Until then play() returns false and the caller falls back.
(() => {
  if (globalThis.B365H_player) return;

  const KINDS = ['corner', 'full'];
  const buffers = {};
  let ctx = null;

  async function init() {
    try {
      ctx = new AudioContext();
      await Promise.all(
        KINDS.map(async (kind) => {
          const res = await fetch(chrome.runtime.getURL(`sounds/${kind}.wav`));
          buffers[kind] = await ctx.decodeAudioData(await res.arrayBuffer());
        }),
      );
    } catch (err) {
      console.warn('[bet365-helper] in-page audio unavailable, using fallback', err);
      ctx = null;
    }
  }

  // resume() only succeeds inside a user gesture, so retry on every interaction.
  const unlock = () => {
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  };
  for (const type of ['pointerdown', 'keydown']) {
    document.addEventListener(type, unlock, { capture: true });
  }

  function play(kind) {
    if (ctx?.state !== 'running' || !buffers[kind]) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffers[kind];
    src.connect(ctx.destination);
    src.start();
    return true;
  }

  init();
  globalThis.B365H_player = { play };
})();
