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

  const KINDS = ['corner', 'full', 'removed', 'ending'];
  const buffers = {};
  let ctx = null;

  // Decode with an OfflineAudioContext: unlike AudioContext it needs no user gesture,
  // and the decoded AudioBuffers play in any context.
  async function load() {
    try {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      await Promise.all(
        KINDS.map(async (kind) => {
          const res = await fetch(chrome.runtime.getURL(`sounds/${kind}.wav`));
          buffers[kind] = await decoder.decodeAudioData(await res.arrayBuffer());
        }),
      );
    } catch (err) {
      console.warn('[bet365-helper] in-page audio unavailable, using fallback', err);
    }
  }

  // An AudioContext created or resumed without a user gesture stays suspended and
  // Chrome reports a warning under the extension's errors. So only touch it once the
  // page has a real gesture (bet365 also dispatches synthetic, untrusted events).
  const unlock = () => {
    if (!navigator.userActivation?.isActive) return;
    if (!ctx) ctx = new AudioContext();
    else if (ctx.state === 'suspended') ctx.resume().catch(() => {});
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

  // False while alerts would go through the slower fallback player.
  const ready = () => ctx?.state === 'running' && KINDS.every((kind) => buffers[kind]);

  load();
  unlock(); // re-injected after the user already interacted with this page
  globalThis.B365H_player = { play, ready };
})();
