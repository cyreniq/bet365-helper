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

// Feed scans in order, returning the alert of each. A scan is a market list, or
// { markets, at } to set the clock (ms); plain scans are 1 s apart.
function run(...scans) {
  let state = initialState();
  let now = 0;
  return scans.map((scan) => {
    const { markets, at } = Array.isArray(scan) ? { markets: scan } : scan;
    now = at ?? now + 1000;
    const r = classify(state, markets, { now });
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

test('staged reopening after a goal does not alert corner', () => {
  const all = [...CORNERS, ...OTHERS];
  assert.deepEqual(
    run(
      page(),
      page(all), // goal: everything closes
      page(CORNERS), // main markets reopen first, corners still closed
      page(['Corners']), // most corners reopen; full closure ends here
      page(CORNERS), // corner flicker right after
    ),
    [null, 'full', null, null, null],
  );
});

test('corner alerts resume once the quiet period after a full closure has passed', () => {
  const all = [...CORNERS, ...OTHERS];
  assert.deepEqual(
    run(
      { markets: page(), at: 0 },
      { markets: page(all), at: 1000 },
      { markets: page(), at: 2000 }, // full closure ends
      { markets: page(CORNERS), at: 5000 }, // inside quiet period
      { markets: page(), at: 20000 },
      { markets: page(CORNERS), at: 21000 },
    ),
    [null, 'full', null, null, null, 'corner'],
  );
});

test('an empty scan mid re-render does not end a full closure', () => {
  const all = [...CORNERS, ...OTHERS];
  assert.deepEqual(run(page(), page(all), [], page(CORNERS), page(all)), [null, 'full', null, null, null]);
});
