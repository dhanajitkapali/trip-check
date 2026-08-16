# Trip Check

A packing checklist that clears itself every new day. Tick things off before
you leave — towel, bottle, charger — and it's a clean slate tomorrow.

**Live:** https://dhanajitkapali.github.io/trip-check

## How it works

- **Daily auto-reset** — the app stores the day it was last used. Open it on a
  new calendar day and every tick clears automatically. Your *item list* stays.
- **Reset button** — clears the ticks on demand (for a second trip the same day).
- **Editable list** — add or delete items in the app; the list persists.
- **Installable** — Add to Home Screen on iPhone/Android and it runs fullscreen,
  offline included.

Everything is stored in the browser's `localStorage`, so there's no backend and
no account. That also means state is **per-device** — your phone and laptop keep
their own lists.

## Tech Stack

Plain HTML, CSS and JavaScript — no framework, no build step. Plus a web
manifest and a service worker for offline/installable use. Hosted on GitHub
Pages straight from `main`.

## Run locally

No dependencies, no build. Just serve the folder:

```bash
python3 -m http.server 4180
```

Then open http://localhost:4180. (Opening `index.html` directly via `file://`
works too, but the service worker only registers over http/https.)

## Deploy

Push to `main` — GitHub Pages serves it as-is:

```bash
git push
```

In the repo's **Settings → Pages**, set Source to *Deploy from a branch*,
branch `main`, folder `/ (root)`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | All styling |
| `app.js` | State, daily rollover, rendering |
| `manifest.json`, `service-worker.js` | PWA (installable + offline) |
| `icons/` | App icons |

To change the starter items, edit `DEFAULT_ITEMS` in [app.js](app.js) — it only
applies to a fresh install, since your saved list takes over after that.
