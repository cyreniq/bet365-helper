// Service worker: per-tab arming, (re-)injection of the monitor, fallback alert playback.
// Chrome may stop this worker between events, so armed tabs live in storage.session.

const BET365_URL = /^https?:\/\/([a-z0-9-]+\.)*bet365\.(com|ee|es|it|gr|dk|de|mx|ca|com\.au)\//i;
const MONITOR_FILES = ['content/bet365.js', 'content/classify.js', 'content/player.js', 'content/monitor.js'];

async function getArmed() {
  const { armedTabs = [] } = await chrome.storage.session.get('armedTabs');
  return new Set(armedTabs);
}

async function setArmed(set) {
  await chrome.storage.session.set({ armedTabs: [...set] });
}

async function showBadge(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' });
  if (on) await chrome.action.setBadgeBackgroundColor({ tabId, color: '#1a8a3a' });
}

async function injectMonitor(tabId) {
  // The shim normally loads at document_start via the manifest; injecting it here
  // too covers tabs that were already open when the extension was installed.
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/raf-shim.js'], world: 'MAIN' });
  await chrome.scripting.executeScript({ target: { tabId }, files: MONITOR_FILES });
}

async function arm(tabId) {
  const armed = await getArmed();
  armed.add(tabId);
  await setArmed(armed);
  await injectMonitor(tabId);
  await showBadge(tabId, true);
  // Warm up the fallback player so an alert in the next 30 s doesn't wait for it.
  await ensureOffscreen();
}

async function disarm(tabId, { tabGone = false } = {}) {
  const armed = await getArmed();
  armed.delete(tabId);
  await setArmed(armed);
  if (tabGone) return;
  await chrome.tabs.sendMessage(tabId, { type: 'stop' }).catch(() => {});
  await showBadge(tabId, false);
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
  await showBadge(tabId, true);
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
  if (msg?.type !== 'closure' || msg.playedHere || !sender.tab) return;
  getArmed().then(async (armed) => {
    if (!armed.has(sender.tab.id)) return;
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', kind: msg.kind });
  });
});
