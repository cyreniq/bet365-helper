// Offscreen document: fallback alert playback when the bet365 page can't play audio
// itself (content/player.js). Sounds are preloaded when the document is created.

const SOUNDS = {
  corner: new Audio('sounds/corner.wav'),
  full: new Audio('sounds/full.wav'),
};
for (const audio of Object.values(SOUNDS)) audio.preload = 'auto';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'play') return;
  const audio = SOUNDS[msg.kind];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch((err) => console.warn('[bet365-helper] audio failed', err));
});
