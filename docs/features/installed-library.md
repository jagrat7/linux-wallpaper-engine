# Installed library

The Installed page lists every Wallpaper Engine wallpaper downloaded through Steam. Users search it, filter it by tags, compatibility, resolution, age rating and type, sort it, and click a card to open a details panel with metadata, Apply, and per-wallpaper settings.

## Sub-features

- `library-list`: the grid renders local wallpapers as cards (`img` + `heading [level=3]`).
- `library-search`: the `Search wallpapers...` box narrows the grid by title as you type.
- `library-filter`: the `Filters` menu toggles Tags, Compatibility, Resolution, Age rating and Type. The button label counts active filters, for example `1 Filters` for the default age rating `G`.
- `library-sort`: the sort menu offers Name, Date Added, Size, Recent and Ascending/Descending.
- `library-details`: clicking a card opens the details panel (`complementary`) with title, author, Type, Resolution, Size, Tags, Compatibility and Settings.
- `library-refresh`: `Refresh` rescans the Steam folders.

## How to get to it (user POV)

- Sidebar `Installed`. It is the default route `/`.
- The status bar's active wallpaper title navigates to `/?wallpaper=<id>` and opens that wallpaper's details.
- The scan reminder banner links to Settings, not here. Ignore it for this feature.

## Driving it with lwe

Preconditions:

- `$LWE doctor` is healthy. The user's Steam library has at least one installed wallpaper, so `$LWE drive count --role heading --exact --name "<any title>"` is ≥ 1.
- Filters are at defaults. Each run starts fresh, so the age rating is `G` only.

- **List.** Open Installed. Run `$LWE drive click --role button --name Installed --exact` and `$LWE drive snapshot --css main --path $A/library-list.aria.txt`. The main region shows `heading "Installed"` and at least one `heading [level=3]`. Pick one title as `$T` and a distinctive word from it as `$Q`.
- **Search.** Type the word. Run `$LWE drive fill --role textbox --name "Search wallpapers..." --value "$Q"`, then `$LWE drive snapshot --css main --path $A/library-search.aria.txt`. Every remaining `heading [level=3]` contains `$Q` (case-insensitive), and titles without it are gone.
- **Clear search.** Run `$LWE drive fill --role textbox --name "Search wallpapers..." --value ""`. The full grid returns.
- **Filter.** Open the filters menu and pick a tag. Run `$LWE drive click --role button --name Filters`, `$LWE drive snapshot --css '[role=menu]'` to list the options, then `$LWE drive click --role menuitem --name "<tag>" --exact` and `$LWE drive press --key Escape`. The button reads `2 Filters` and the grid shrinks. Undo it with `Filters` → `Clear All`, which also clears the default `G`, so re-check `G`, or relaunch. The choice persists to the store as `filterTags`, readable with `$LWE store settings`.
- **Sort.** Run `$LWE drive click --role button --name Name --exact`, then `$LWE drive click --role menuitem --name Size`. The sort button now reads `Size` and the card order changes. `$LWE store settings` shows `"sortBy": "size"`.
- **Details.** Click a card. Run `$LWE drive click --role heading --name "$T" --exact`, then `$LWE drive wait --role heading --name "$T" --exact --within aside` and `$LWE drive snapshot --css aside --path $A/library-details.aria.txt`. The panel has `heading "$T" [level=2]`, an `Apply` button, `Type`/`Resolution`/`Size`, and a `Settings` section. If `--within aside` doesn't match, use `--css 'xpath=//*[@role="complementary" or local-name()="aside"]'` with `snapshot`.
- **Proof.** Run `$LWE drive screenshot --path $A/library-details.png`. The screenshot shows the sidebar, the filtered or searched grid, and the open details panel.

## Gotchas

- The grid is virtualized (`@tanstack/react-virtual`): offscreen cards aren't in the DOM. Search for a title before asserting it exists. Don't scroll and count.
- Default age-rating filter `G` hides R and PG13 wallpapers. A wallpaper missing from the grid may just be filtered out.
- A heading is both the card title and the panel title once the panel is open. Use `--exact`, and scope to the panel when asserting it opened.
- `Refresh` rescans disk and can take seconds with large libraries. Wait for a known heading.
- Content depends on the user's Steam library. Never record a specific title as a permanent precondition.
