# bet365 Helper

A Chrome extension that alerts you with a sound and a coloured flash when bet365 suspends or removes markets on a live football match you're watching.

It doesn't place bets, change anything on your account or send data anywhere.

## Alerts

| Alert | When it fires | Sound | Flash |
|---|---|---|---|
| Corner closure | Corner markets are suspended | Two short high beeps | Yellow |
| Full closure | About 75% or more of the other markets are suspended, usually after a goal | Three descending tones | Red |
| Corners removed | The Corners/Cards tab disappears, which is how bet365 pulls corner markets late in a match | Three quick rising chirps | Orange |
| Match ending | The event is down to its last one or two markets, all suspended, shortly before full time | Ding-dong, twice | Blue |

The flash appears on the dark panel around the live match graphic, so keep that panel open to see it.

Markets that are already suspended when you start monitoring or open them don't alert. Only a market seen open and then suspended counts.

## Install

The extension isn't in the Chrome Web Store, so it's loaded from a local folder:

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Optionally, pin bet365 Helper to the toolbar so its badge is always visible.

## Usage

1. Open a live match on bet365.
2. Click the toolbar icon to start monitoring that tab. Click it again to stop.
3. Click anywhere on the bet365 page once, so alerts can use the faster audio path.

Monitoring is per tab. It survives a reload of the tab, and stops when the tab closes, leaves bet365 or Chrome restarts.

### Toolbar badge

| Badge | Meaning |
|---|---|
| Grey icon, no badge | This tab isn't being monitored |
| Yellow **ON** | Monitoring, with alerts at full speed |
| Flashing **ON** | Monitoring, but you haven't clicked the page since it loaded, so sounds play slightly later |
| Flashing red **?** | No markets found for 5 seconds: this isn't a match page, or bet365 has changed its page |

## Limitations

- **Stalled pages:** bet365 pages sometimes stop updating until they're reloaded. No alerts fire while that happens, and the badge still shows ON.
- **Dependence on bet365's page:** the extension reads bet365's internal page data, so a bet365 update can break it. The red **?** badge usually shows when that has happened.
- **Tab-dependent counts:** closures are judged from the markets shown on the selected market tab. Card markets closing on the Corners/Cards tab can fire a false full closure, and switching to a tab with only one or two suspended markets can fire a false match ending.
- **Match ending alert:** it's based on a description of how bet365 closes a match and one observed end state. The full sequence hasn't been recorded.
- **Moving between events:** alerts pause for 3 seconds after the page's address changes to a different `#` location.

## Supported sites

bet365 on `.com`, `.ee`, `.es`, `.it`, `.gr`, `.dk`, `.de`, `.mx`, `.ca` and `.com.au`.

## Development

Plain JavaScript with no build step or dependencies. Tests need Node.js, and regenerating the sounds needs Python 3.

```sh
node --test                      # run the tests
python3 scripts/make_sounds.py   # regenerate the alert sounds
```

After changing the code, reload the extension at `chrome://extensions`, then reload the bet365 tab. Diagnostics appear in the bet365 page's console, prefixed `[bet365-helper]`.

Only the alert logic in `content/classify.js` has automated tests. Everything else needs checking on a live bet365 page.
