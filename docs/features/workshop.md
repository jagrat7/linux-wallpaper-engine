# Workshop

The Workshop page browses Steam Workshop wallpapers for Wallpaper Engine (app 431960) without leaving the app. It has a Discover view of curated sections that users can favorite, a Browse view with search, filters and sort, and per-item details. Data comes from Steam through `steamworks.js`, so Steam must be running and logged in.

## Sub-features

- `workshop-discover`: the `Discover` tab (pressed by default) shows sections with `See more` and `Add to favorites`.
- `workshop-browse`: the `Browse` tab is a paged grid of workshop items.
- `workshop-search`: `Search workshop...` queries the Workshop.
- `workshop-filter-sort`: the `Filters` menu and the sort button (`Trending`, ...). These persist as `workshopFilter*` and `workshopSortBy` in the store.
- `workshop-details`: clicking an item opens its details. Subscribing downloads it into the Installed library.

## How to get to it (user POV)

- Sidebar `Steam Workshop` (`/workshop`).

## Driving it with lwe

Preconditions:

- `$LWE doctor` is healthy.
- Steam is running and logged in (`pgrep -x steam` or `pgrep -f steamwebhelper`), and there is network access. If not, report every `workshop-*` sub-feature as **unverified: Steam not running**. Don't substitute anything else.

- **Open.** Run `$LWE drive click --role button --name "Steam Workshop"`, then `$LWE drive wait --role heading --name Workshop --exact`. `button "Discover" [pressed]` and `button "Browse"` are visible.
- **Discover loads.** Run `$LWE drive wait --text "See more"`. Once data arrives, the `Add to favorites` buttons become enabled (they are `[disabled]` while loading). Capture `$LWE drive snapshot --css main --path $A/discover.aria.txt`.
- **Browse.** Run `$LWE drive click --role button --name Browse`. Workshop item cards appear. Capture a snapshot and a screenshot.
- **Search.** Run `$LWE drive fill --role textbox --name "Search workshop..." --value "nature"` and wait for the results to change. The result titles relate to the query.
- **Sort.** Run `$LWE drive click --role button --name Trending`, then pick another `menuitem`. The button label changes, and `$LWE store settings | jq .workshopSortBy` matches it.
- **Subscribe (only with the user's consent: it changes their real Steam subscriptions and downloads files).** Open an item's details and subscribe. The item then appears in Installed after `Refresh`. Unsubscribe afterwards.

## Gotchas

- Without Steam, the page shows empty or loading sections. That is an environment limitation, not a pass and not necessarily a bug.
- Subscribing and unsubscribing are real Steam account actions. Never do them by default.
- Results are live Workshop data and change minute to minute. Assert structure and query relevance, not specific titles.
- The default workshop age-rating filter is `G` (`1 Filters`).
