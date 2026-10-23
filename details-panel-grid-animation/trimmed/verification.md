# PR 121 trimmed-change verification

Product SHA: 59b6639eb4a6f3311c46c0a49aaed5d758d73e0b
Compared with pre-trim SHA: 2abef31755c9fa2770bf769fea3ee07b8a7e7ede

Removed the CSS-variable opacity workaround and its 106-line computed-style sampler. Restored the shared glass border; only SearchInput reserves transparent border space. Net PR diff versus main: 9 files, 130 insertions, 146 deletions (previously 11 files, 249 insertions, 149 deletions).

## Method

Project verification skill, isolated web mode (same DEV_TARGET=web as bun dev), real installed images. Temporary checkout /tmp/lwe-pr121-sol used backend 5192 and CDP 9350 to avoid the user's running server. Four changed renderer files were copied byte-for-byte from the parent; temporary port edits are not in the product commit. No wallpaper was applied, stopped, paused, or muted. Steam configuration was unchanged; instance cleaned up.

capture.mjs records CDP compositor frames with timestamps and checks settled panel/background counts plus search geometry each requestAnimationFrame. It does not assert computed-opacity monotonicity. pixels.py samples a static central background region (600,300)-(1000,700), grayscale 0–255. MP4s use the actual capture timestamps; GIFs are resampled for display. Capture can omit frames and does not prove that every GPU/display behaves identically.

## Results

- Three Zoro open/close cycles before trim: 223 captured frames.
- Three Zoro open/close cycles after trim: 286 captured frames.
- Three Zoro open/close cycles after trim at 4x CPU throttling: 296 captured frames.
- No full-background opacity flash in captured pixels. Largest reverse brightness step after trim was 1.242/255, against a roughly 35-level fade range, at both CPU rates. This is not a pixel-perfect monotonicity claim.
- Search geometry stayed fixed throughout all sampled transitions: 38px height after trim, y=168. Before trim it was consistently 36px. The reserved transparent border accounts for the intentional 2px difference and preserves the glass outline.
- Exactly one panel/background after opening; zero after closing. 24/24 common thumbnail image nodes preserved across grid resize.
- Rapid reopen during exit: one panel and one background.
- Closing during a 900ms image load: zero background/glass nodes after completion.
- Switching selections: correct new title and one background.
- Scroll remains 1500px before/open/closed, with visible grid images and no horizontal overflow; Scroll to Top returns to zero.
- 1600x1000 and 1920x1080 panel layouts exercised.
- Dynamic backgrounds disabled via Settings: one panel, zero background/glass nodes; isolated store confirmed false.
- bun run check passed (existing warnings); 186 tests passed in 19 files.
- Changed-file formatting passed; full fmt:check reports unchanged dev/verify/drive.mjs.

Native Electron and live Workshop were not rerun in this trim verification. Earlier original-release grid comparison is retained separately; the new comparison shows previous PR versus trimmed PR, not original v0.4.12 versus final.
