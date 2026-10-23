# Light-theme correction, PR 121

Final product commit: 3ee802e. Before: 59b6639.

Opus independently captured a visible one-frame background/preview flash with native opacity animation. This contradicts the earlier conclusion based on dark-theme captures. The parent reproduced it independently in an isolated web-mode instance using the real Zoro wallpaper.

At 1600x1000, three open/close cycles on 59b6639 yielded 235 lossless PNG compositor frames and four one-frame excursions over 10 grayscale levels in the static center background crop (600,300)-(1000,700). One sequence measured 219.9 → 252.0 → 219.2; before-flash.png shows the actual consecutive frames.

After restoring custom-property opacity animation on the background image and details surface, three light-theme cycles yielded 215 frames with zero such excursions; three dark-theme cycles yielded 217 frames with zero. fixed.gif shows the light-theme recording at half speed. Capture can omit frames: this is evidence from the tested environment, not a guarantee across all GPUs. The precise compositor mechanism remains an inference from Motion's completion/cancellation behavior. The earlier computed-style sampler did not prove painted flicker and remains deleted.

The global glass utility remains identical to main. SearchInput alone reserves transparent border space. No other product changes were added in this correction. The full PR now has 9 files, +138/-149.

Lint/type checks passed with existing warnings; 186 tests passed; formatting of the two edited files passed. Settled final state had zero details panels, backgrounds and glass nodes. No wallpapers applied or stopped; Steam configuration unchanged. Isolated instance cleaned up. Native Electron and live Workshop not rerun.

Local raw frames: /tmp/lwe-pr121-light-run/20261023-153437-web/artifacts/{before,after,after-dark}/. Capture used the Opus pixel-probe.mjs script with independent backend 5193/CDP 9360 and theme selected through Settings. Scripts stayed outside the product branch.
