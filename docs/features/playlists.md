# Playlists

Playlists rotate through a set of wallpapers on a timer. Users create them in an editor (name, interval, order, overrides, selected wallpapers), apply them to one display or all of them, edit them, and delete them. Playlists are stored in Steam Wallpaper Engine's own `config.json`, so they are shared with the Windows-format config.

## Sub-features

- `playlist-list`: `/playlists` lists each playlist as a row with its name, count, interval, `Apply` split button, an actions menu, and a carousel.
- `playlist-search`: `Search playlists` narrows the rows.
- `playlist-create`: `New Playlist` → the editor (`/playlists/editor`) → name, interval, order, select wallpapers → `Save Playlist`.
- `playlist-edit`: the row's actions menu → `Edit` opens the editor with `?name=<name>` and saves changes.
- `playlist-delete`: the row's actions menu → `Delete` removes the playlist immediately, with no confirmation.
- `playlist-apply`: the row's `Apply` (or chevron → display) starts the rotation, which spawns a backend like a single wallpaper does.
- `playlist-cancel`: `Cancel` in the editor discards the draft.

## How to get to it (user POV)

- Sidebar `Playlists`, then `New Playlist`, a row's `Apply`, or a row's `⋮` menu.
- The status bar shows the playlist when one is active, and Stop there stops the playlist.

## Driving it with lwe

Preconditions:

- `$LWE doctor` is healthy, and `$LWE steam-config path` prints the Steam config, with the backup taken at launch.
- Use a run-scoped name: `P=lwe-verify-$(basename $(readlink -f /tmp/lwe-verify/current))`. Run `$LWE drive count --role heading --name "$P" --exact`, which must print `0`.
- Row XPath helper: `ROW="xpath=//h3[text()=\"$P\"]/ancestor::div[.//button[@aria-haspopup=\"menu\"]][1]//button[@aria-haspopup=\"menu\"]"`. Use `--nth 0` for the Apply chevron and `--nth 1` for the `⋮` actions menu.

- **Open the editor.** Run `$LWE drive goto /playlists`, then `$LWE drive click --role button --name "New Playlist"`. `$LWE drive url` ends with `#/playlists/editor`, and `heading "New Playlist"` is visible.
- **Fill.** Run `$LWE drive fill --role textbox --name "Playlist Name" --value "$P"`. Select two wallpapers by clicking their card headings: `$LWE drive click --role heading --name "<title>" --exact`, twice with different titles. The text `Selected 2 wallpapers` appears.
- **Save.** Run `$LWE drive click --role button --name "Save Playlist"`. The app returns to `/playlists`, and `$LWE drive wait --role heading --name "$P" --exact` succeeds. The row shows `2` and `1m`.
- **Side effect.** Run `$LWE steam-config diff`. The only change is a new entry in `steamuser.general.playlists` named `$P`, with two `items` and `settings.delay: 1`. Save it with `$LWE steam-config diff > $A/create.diff`.
- **Persist.** Run `$LWE drive reload`, then `$LWE drive wait --role heading --name "$P" --exact`.
- **Edit.** Run `$LWE drive click --css "$ROW" --nth 1`, then `$LWE drive click --role menuitem --name Edit`. The editor opens with the name prefilled. Change the interval, save, and confirm the row and `steam-config diff` both show the new delay.
- **Apply (optional, follows the `wallpaper-apply.md` preconditions).** Run `$LWE drive click --css "$ROW" --nth 0`, then `$LWE drive click --role menuitem --name DP-1 --exact`. The footer shows the playlist, and a backend process appears. Stop it from the footer `Stop wallpaper`.
- **Delete (also the fixture cleanup).** Run `$LWE drive click --css "$ROW" --nth 1`, then `$LWE drive click --role menuitem --name Delete`. `$LWE drive wait --role heading --name "$P" --exact --state hidden` succeeds, and `$LWE steam-config diff` prints `unchanged since launch`. Pretty-printing may differ; if so, check that the `playlists` array matches.
- **Proof.** Capture `$LWE drive snapshot --css main --path $A/<step>.aria.txt` and `$LWE drive screenshot --path $A/<step>.png` after create, edit and delete, plus the diffs above.

## Gotchas

- **This writes the user's real Steam config.** Use only `lwe-verify-*` names, delete through the UI, and confirm with `steam-config diff` before cleanup. The user's existing playlists, such as `cars`, must stay byte-identical.
- If the user's Wallpaper Engine (Steam/Proton) or their own copy of this app writes the config during the run, `steam-config restore` would undo their change. Prefer deleting through the UI.
- Delete has no confirmation dialog.
- Row icon buttons are unnamed. Use the XPath helper rather than `--nth` across the whole page, because every row has the same two menu buttons.
- Editor selection uses the same virtualized grid as Installed. Search inside the editor before clicking an offscreen title.
