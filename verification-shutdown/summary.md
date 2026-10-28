# Verification cleanup crash fix

The original group-wide TERM killed Electron helpers alongside their parent. The baseline run ended with GPU restart failures and a fatal GPU error. Five historical Electron core dumps accompanied that cleanup pattern.

A process-level regression test against the original harness failed with this trace:

```
helper-term
parent-term
helper-already-dead
```

The fixed harness passed with:

```
parent-term
helper-still-alive
helper-term
parent-exit
```

Real verification: two web launches and one desktop launch, each followed by doctor and cleanup, all succeeded. Cleanup logged no forced termination or fatal errors. No new core dumps were recorded since 2026-10-28 21:50:00 UTC. Ports 5180 and 9333 were released.

Validation: all 191 tests across 20 files pass; lint and typecheck pass with existing warnings; changed TypeScript formatting, bash syntax, and git whitespace checks pass. Five new tests cover parent/helper ordering, the separate headless browser group, unrelated-process isolation and evidence retention, a previously exited app, forced shutdown failure, and fatal log failure.

No application product code changed. Web remains the default verification target. Test runs used isolated config directories and did not apply or stop wallpapers.
