const test = require('node:test');
const assert = require('node:assert/strict');
const { initialState, classify } = require('../content/classify.js');

const CORNERS = ['2-Way Corners', 'Corners', 'Match Corners', '1st Half Corners'];
const OTHERS = ['Fulltime Result', 'Double Chance', '2nd Goal', 'Match Goals', 'Draw No Bet'];

// Build a market list where `suspended` is the set of suspended titles.
function page(suspended = [], titles = [...CORNERS, ...OTHERS]) {
  const s = new Set(suspended);
  return titles.map((title) => ({ title, suspended: s.has(title), corner: /corner/i.test(title) }));
}

// Feed scans in order, returning the alert of each.
function run(...scans) {
  let state = initialState();
  return scans.map((markets) => {
    const r = classify(state, markets);
    state = r.state;
    return r.alert;
  });
}

test('first scan never alerts, even if everything is suspended', () => {
  assert.deepEqual(run(page([...CORNERS, ...OTHERS])), [null]);
});

test('corner markets closing alerts corner, reopening is silent', () => {
  assert.deepEqual(run(page(), page(CORNERS), page()), [null, 'corner', null]);
});

test('everything closing alerts full only', () => {
  assert.deepEqual(run(page(), page([...CORNERS, ...OTHERS])), [null, 'full']);
});

test('corner closure followed by full closure alerts both', () => {
  assert.deepEqual(run(page(), page(CORNERS), page([...CORNERS, ...OTHERS])), [null, 'corner', 'full']);
});

test('no corner alert while a full closure is active', () => {
  const all = [...CORNERS, ...OTHERS];
  const allButOneCorner = all.filter((t) => t !== 'Corners');
  assert.deepEqual(run(page(), page(allButOneCorner), page(all)), [null, 'full', null]);
});

test('full closure can alert again after markets reopen', () => {
  const all = [...CORNERS, ...OTHERS];
  assert.deepEqual(run(page(), page(all), page(), page(all)), [null, 'full', null, 'full']);
});

test('a single non-corner market closing is silent', () => {
  assert.deepEqual(run(page(), page(['2nd Goal'])), [null, null]);
});

test('markets that appear already suspended (re-render, tab switch) are silent', () => {
  const popularOnly = page([], OTHERS);
  const cornersTabSuspended = page(CORNERS, [...CORNERS, 'Fulltime Result']);
  assert.deepEqual(run(popularOnly, cornersTabSuspended), [null, null]);
});

test('state carries over markets missing from one scan', () => {
  assert.deepEqual(run(page(), [], page(CORNERS)), [null, null, 'corner']);
});

test('with too few non-corner markets rendered, a closure counts as corner', () => {
  const titles = [...CORNERS, 'Fulltime Result'];
  assert.deepEqual(run(page([], titles), page(titles, titles)), [null, 'corner']);
});
