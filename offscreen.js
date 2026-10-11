// Offscreen document: the only extension context here that can play audio.

const SOUNDS = {
  corner: 'sounds/corner.wav',
  full: 'sounds/full.wav',
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'play') return;
  const src = SOUNDS[msg.kind];
  if (!src) return;
  new Audio(src).play().catch((err) => console.warn('[bet365-helper] audio failed', err));
});
