// Service worker: per-tab arming, (re-)injection of the monitor, fallback alert playback.
// Chrome may stop this worker between events, so armed tabs live in storage.session.

const BET365_URL = /^https?:\/\/([a-z0-9-]+\.)*bet365\.(com|ee|es|it|gr|dk|de|mx|ca|com\.au)\//i;
const MONITOR_FILES = ['content/bet365.js', 'content/classify.js', 'content/player.js', 'content/flash.js', 'content/monitor.js'];

async function getArmed() {
  const { armedTabs = [] } = await chrome.storage.session.get('armedTabs');
  return new Set(armedTabs);
}

async function setArmed(set) {
  await chrome.storage.session.set({ armedTabs: [...set] });
}

const iconPaths = (suffix) =>
  Object.fromEntries([16, 32, 48, 128].map((n) => [n, `icons/icon${n}${suffix}.png`]));

// Badge looks for an armed tab, picked by monitor.js (see its tick()).
const BADGES = {
  // bet365's yellow and green, so the badge stands out against the green icon.
  on: { text: 'ON', bg: '#FFDF1B', fg: '#126E51' },
  // Alternates with `on` while alerts can only use the slower fallback player.
  onAlt: { text: 'ON', bg: '#126E51', fg: '#FFDF1B' },
  // No markets found on the page: wrong page, or bet365 changed its markup.
  missing: { text: '?', bg: '#D93025', fg: '#FFFFFF' },
  // Alternates with `missing`.
  missingAlt: { text: '?', bg: '#FFFFFF', fg: '#D93025' },
};

// look: a BADGES key, or null for a tab that isn't armed.
async function showBadge(tabId, look) {
  const badge = BADGES[look];
  await chrome.action.setIcon({ tabId, path: iconPaths(badge ? '' : '_disabled') });
  await chrome.action.setBadgeText({ tabId, text: badge?.text ?? '' });
  if (!badge) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.bg });
  await chrome.action.setBadgeTextColor({ tabId, color: badge.fg });
}

async function injectMonitor(tabId) {
  // The shim normally loads at document_start via the manifest; injecting it here
  // too covers tabs that were already open when the extension was installed.
  // feed-bridge.js copies bet365's feed data onto the DOM for the isolated-world monitor.
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/raf-shim.js', 'content/feed-bridge.js'],
    world: 'MAIN',
  });
  await chrome.scripting.executeScript({ target: { tabId }, files: MONITOR_FILES });
}

async function arm(tabId) {
  const armed = await getArmed();
  armed.add(tabId);
  await setArmed(armed);
  try {
    await injectMonitor(tabId);
  } catch (err) {
    // E.g. Chrome's error page after a failed load. Don't stay armed behind a grey icon.
    console.warn('[bet365-helper] could not start monitoring', err);
    await disarm(tabId);
    return;
  }
  await showBadge(tabId, 'on');
  // Warm up the fallback player so an alert in the next 30 s doesn't wait for it.
  await ensureOffscreen();
}

async function disarm(tabId, { tabGone = false } = {}) {
  const armed = await getArmed();
  armed.delete(tabId);
  await setArmed(armed);
  if (tabGone) return;
  await chrome.tabs.sendMessage(tabId, { type: 'stop' }).catch(() => {});
  await showBadge(tabId, null);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!BET365_URL.test(tab.url || '')) return;
  const armed = await getArmed();
  if (armed.has(tab.id)) await disarm(tab.id);
  else await arm(tab.id);
});

// A reload or full navigation drops the injected monitor; put it back.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const armed = await getArmed();
  if (!armed.has(tabId)) return;
  if (!BET365_URL.test(tab.url || '')) {
    await disarm(tabId);
    return;
  }
  await injectMonitor(tabId);
  await showBadge(tabId, 'on');
});

chrome.tabs.onRemoved.addListener((tabId) => disarm(tabId, { tabGone: true }));

let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play market-closure alert sounds.',
    })
    .finally(() => {
      creatingOffscreen = null;
    });
  await creatingOffscreen;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  if (msg?.type === 'badge' && msg.look in BADGES) {
    getArmed().then((armed) => armed.has(tabId) && showBadge(tabId, msg.look));
  } else if (msg?.type === 'closure' && !msg.playedHere) {
    getArmed().then(async (armed) => {
      if (!armed.has(tabId)) return;
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', kind: msg.kind });
    });
  }
});
