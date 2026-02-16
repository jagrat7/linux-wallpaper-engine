# Playlist System: From Steam to linux-wallpaperengine

## Overview

The playlist system allows automatic wallpaper rotation with customizable timing and ordering. Instead of using cronjobs, playlists are defined in Steam's Wallpaper Engine `config.json` and read directly by `linux-wallpaperengine` using the `--playlist` flag.

---

## How It Works: The Complete Flow

### 1. Steam Wallpaper Engine Configuration

**Location:** `~/.local/share/Steam/steamapps/common/wallpaper_engine/config.json`

Steam's Wallpaper Engine stores all user preferences, including playlists, in this JSON file. The file has a specific structure:

```json
{
  "steamuser": {
    "general": {
      "playlists": [
        {
          "name": "My Playlist",
          "items": [
            "C:\\Program Files\\Steam\\steamapps\\workshop\\content\\431960\\1234567890",
            "C:\\Program Files\\Steam\\steamapps\\workshop\\content\\431960\\0987654321"
          ],
          "settings": {
            "delay": 60,
            "mode": "timer",
            "order": "sequential",
            "updateonpause": false,
            "videosequence": false
          }
        }
      ]
    },
    "wallpaperconfig": {
      "selectedwallpapers": {
        "Monitor0": {
          "playlist": {
            "name": "Monitor Specific Playlist",
            "items": ["..."],
            "settings": { "..." }
          }
        }
      }
    }
  }
}
```

**Two Storage Locations:**

1. **`steamuser.general.playlists`** - Array of named playlists available globally
2. **`steamuser.wallpaperconfig.selectedwallpapers.<MonitorName>.playlist`** - Per-monitor playlist assignments

---

### 2. Playlist Structure

Each playlist object has three main components:

#### **name** (string)
- Unique identifier for the playlist
- Used with `--playlist <name>` flag

#### **items** (array of strings)
- Wallpaper paths (Windows-style on Windows, converted to Linux paths)
- Can be Workshop IDs or full paths to wallpaper directories
- Example: `"C:\\...\\431960\\1234567890"` → `/home/user/.local/share/Steam/steamapps/workshop/content/431960/1234567890`

#### **settings** (object)
- **delay** (number): Minutes between wallpaper switches (default: 60)
- **mode** (string): Currently only `"timer"` is supported
- **order** (string): `"sequential"` or `"random"`
- **updateonpause** (boolean): Whether to continue timer when paused (default: false)
- **videosequence** (boolean): Video-specific sequencing (default: false)

---

### 3. linux-wallpaperengine Parsing

When you run `linux-wallpaperengine --playlist "My Playlist"`, here's what happens:

#### Step 1: Locate config.json
```cpp
// ApplicationContext::configFilePath()
// Searches: ~/.local/share/Steam/steamapps/common/wallpaper_engine/config.json
```

#### Step 2: Parse JSON
```cpp
// ApplicationContext::loadPlaylistsFromConfig()
// Reads steamuser.general.playlists[] and steamuser.wallpaperconfig.selectedwallpapers
```

#### Step 3: Build Playlist Definition
```cpp
// ApplicationContext::buildPlaylistDefinition()
PlaylistDefinition {
  name: "My Playlist",
  items: [resolved_paths],
  settings: {delay, mode, order, updateonpause, videosequence}
}
```

#### Step 4: Resolve Item Paths
```cpp
// ApplicationContext::resolvePlaylistItemPath()
// Converts Windows paths to Linux paths:
// 1. Strip "\\?\" prefix
// 2. Replace \ with /
// 3. Remove drive letter (C:)
// 4. Ensure leading /
// 5. Normalize path
```

Example transformation:
```
"C:\\Program Files\\Steam\\steamapps\\workshop\\content\\431960\\1234567890"
↓
"/Program Files/Steam/steamapps/workshop/content/431960/1234567890"
↓
"/home/user/.local/share/Steam/steamapps/workshop/content/431960/1234567890"
```

#### Step 5: Initialize Active Playlist

```cpp
// WallpaperApplication::initializePlaylists()
ActivePlaylist {
  definition: PlaylistDefinition,
  order: [0, 1, 2, 3, 4],  // or shuffled if random
  orderIndex: 0,
  nextSwitch: now + std::chrono::minutes(60),  // based on delay setting
  lastUpdate: now,
  failedIndices: set<size_t>{}  // tracks wallpapers that failed to load
}
```

When a playlist is first applied, linux-wallpaperengine:
1. Creates an `ActivePlaylist` state object for each screen
2. Builds an `order` array with indices [0, 1, 2, ...] for all items
3. If `order: "random"`, shuffles the indices immediately
4. Sets `orderIndex` to 0 (or finds current wallpaper if already running)
5. Calculates `nextSwitch` = current time + delay minutes
6. Stores this in a map: `m_activePlaylists[screen] = ActivePlaylist`

#### Step 6: The Rotation Loop - How Automatic Switching Works

**This is the key mechanism - NO cronjobs, NO external timers!**

linux-wallpaperengine runs a continuous render loop (like any graphics application). Every single frame (30-60+ times per second), it calls `updatePlaylists()`:

```cpp
// WallpaperApplication::updatePlaylists()
// Called EVERY FRAME in the main render loop
void updatePlaylists() {
  auto now = std::chrono::steady_clock::now();
  
  // Check each active playlist (one per screen)
  for (auto& [screen, playlist] : this->m_activePlaylists) {
    // Skip if not in timer mode
    if (playlist.definition.settings.mode != "timer")
      continue;
    
    // Skip if only one wallpaper
    if (playlist.definition.items.size() <= 1)
      continue;
    
    // THE KEY CHECK: Has enough time passed?
    if (now < playlist.nextSwitch)
      continue;  // Not yet, keep current wallpaper
    
    // Time's up! Switch to next wallpaper
    this->advancePlaylist(screen, playlist, now);
  }
}
```

**Frame-by-frame checking:**
- At 60 FPS, this check happens 60 times per second
- Extremely lightweight - just a timestamp comparison
- When `now >= nextSwitch`, triggers the switch

**Advancing to next wallpaper:**

```cpp
// WallpaperApplication::advancePlaylist()
void advancePlaylist(const std::string& screen, ActivePlaylist& playlist, TimePoint now) {
  // Move to next index (wraps around with modulo)
  playlist.orderIndex = (playlist.orderIndex + 1) % playlist.order.size();
  
  // If we've looped back to start AND order is random, reshuffle
  if (playlist.orderIndex == 0 && playlist.definition.settings.order == "random") {
    std::shuffle(playlist.order.begin(), playlist.order.end(), rng);
  }
  
  // Get the actual wallpaper path using the order array
  size_t candidateIndex = playlist.order[playlist.orderIndex];
  const auto& nextPath = playlist.definition.items[candidateIndex];
  
  // Try to load the wallpaper
  try {
    loadWallpaperForScreen(screen, nextPath);
    
    // Success! Clear any previous failure for this wallpaper
    playlist.failedIndices.erase(candidateIndex);
    
  } catch (const std::exception& e) {
    // Failed to load - mark it and try next one
    playlist.failedIndices.insert(candidateIndex);
    
    // Recursively try next wallpaper (with safety check)
    if (playlist.failedIndices.size() < playlist.order.size()) {
      return advancePlaylist(screen, playlist, now);
    }
    // All wallpapers failed - keep current one
  }
  
  // Schedule next switch
  uint32_t delayMinutes = std::max(1u, playlist.definition.settings.delayMinutes);
  playlist.nextSwitch = now + std::chrono::minutes(delayMinutes);
  playlist.lastUpdate = now;
}
```

**Key features of this system:**

1. **Automatic failover**: If a wallpaper fails to load, it's marked in `failedIndices` and skipped on future rotations
2. **Seamless looping**: When reaching the end, wraps back to start
3. **Re-randomization**: For random playlists, reshuffles when looping
4. **Pause-aware**: If `updateonpause: false`, paused time doesn't count toward the delay
5. **Per-screen independence**: Each monitor has its own playlist state and timer

**Example timeline:**

```
00:00 - User applies playlist with 30-minute delay
00:00 - Wallpaper #1 loads, nextSwitch = 00:30
00:30 - Frame check: now >= nextSwitch → advance to Wallpaper #2
00:30 - nextSwitch = 01:00
01:00 - Frame check: now >= nextSwitch → advance to Wallpaper #3
01:00 - nextSwitch = 01:30
... continues forever until process is killed
```

**Why this approach is brilliant:**

- ✅ No separate timer threads or processes
- ✅ No system scheduler dependencies
- ✅ Extremely precise (checked every frame)
- ✅ Minimal CPU overhead (just a timestamp comparison)
- ✅ Survives system sleep/wake (timestamps are monotonic)
- ✅ Integrated with the render loop (can pause when rendering pauses)

---

## Implementation in Our App

### Architecture Overview

```
User creates playlist in UI
    ↓
tRPC API call
    ↓
PlaylistService reads/writes config.json
    ↓
WallpaperService applies with --playlist flag
    ↓
linux-wallpaperengine handles rotation automatically
```

### Key Components to Build

#### 1. **Playlist Service** (`src/main/services/playlist.ts`)

**Responsibilities:**
- Find Steam's Wallpaper Engine installation
- Read/parse `config.json`
- CRUD operations on playlists
- Write back to `config.json` safely

**Core Methods:**
```typescript
class PlaylistService {
  // Find config.json location
  async findConfigPath(): Promise<string>
  
  // Read all playlists
  async getPlaylists(): Promise<Playlist[]>
  
  // Create new playlist
  async createPlaylist(playlist: Playlist): Promise<void>
  
  // Update existing playlist
  async updatePlaylist(name: string, playlist: Playlist): Promise<void>
  
  // Delete playlist
  async deletePlaylist(name: string): Promise<void>
  
  // Get playlist by name
  async getPlaylist(name: string): Promise<Playlist | null>
}
```

**Critical Implementation Details:**
- **Atomic writes**: Read → modify → write with backup
- **Path conversion**: Store Linux paths, but linux-wallpaperengine handles conversion
- **Validation**: Ensure all wallpaper paths exist before saving
- **Backup**: Create `config.json.backup` before writing

#### 2. **Wallpaper Service Updates** (`src/main/services/wallpaper.ts`)

Add playlist support to `applyWallpaper`:

```typescript
interface ApplyPlaylistOptions {
  playlistName: string
  screen?: string
  // Other options inherited from ApplyWallpaperOptions
}

async applyPlaylist(options: ApplyPlaylistOptions): Promise<{success: boolean}>
```

**Command construction:**
```typescript
// For specific screen
const args = ['--screen-root', screen, '--playlist', playlistName]

// For window mode
const args = ['--playlist', playlistName]

spawn('linux-wallpaperengine', args)
```

**Important:** Once a playlist is applied with `--playlist`, linux-wallpaperengine manages the rotation internally. No cronjobs needed!

#### 3. **tRPC Routes** (`src/main/trpc/routes/playlist.ts`)

```typescript
export const playlistRouter = trpc.router({
  // List all playlists
  getPlaylists: trpc.procedure.query(async () => {
    return playlistService.getPlaylists()
  }),
  
  // Get single playlist
  getPlaylist: trpc.procedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return playlistService.getPlaylist(input.name)
    }),
  
  // Create playlist
  createPlaylist: trpc.procedure
    .input(z.object({
      name: z.string(),
      items: z.array(z.string()),
      settings: z.object({
        delay: z.number().min(1),
        mode: z.literal('timer'),
        order: z.enum(['sequential', 'random']),
        updateonpause: z.boolean(),
        videosequence: z.boolean(),
      }),
    }))
    .mutation(async ({ input }) => {
      return playlistService.createPlaylist(input)
    }),
  
  // Update playlist
  updatePlaylist: trpc.procedure
    .input(z.object({ /* ... */ }))
    .mutation(async ({ input }) => {
      return playlistService.updatePlaylist(input.name, input)
    }),
  
  // Delete playlist
  deletePlaylist: trpc.procedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      return playlistService.deletePlaylist(input.name)
    }),
  
  // Apply playlist to screen
  applyPlaylist: trpc.procedure
    .input(z.object({
      playlistName: z.string(),
      screen: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return wallpaperService.applyPlaylist(input)
    }),
})
```

#### 4. **Frontend Integration**

Update `src/renderer/routes/playlists.tsx` to:
- Fetch playlists via `trpc.playlist.getPlaylists.useQuery()`
- Create/edit playlists with forms
- Apply playlists to screens
- Show current active playlist status

---

## Key Advantages of This Approach

### ✅ No Cronjobs Required
linux-wallpaperengine handles timing internally once started with `--playlist`

### ✅ Native Integration
Uses the same config.json as Steam's Wallpaper Engine on Windows (via Wine/Proton)

### ✅ Persistent State
Playlists survive app restarts, system reboots

### ✅ Per-Monitor Support
Different playlists for different screens

### ✅ Automatic Failover
If a wallpaper fails to load, linux-wallpaperengine skips to the next one

---

## Implementation Checklist

- [ ] Create `PlaylistService` with config.json read/write
- [ ] Add playlist types to `shared/constants.ts`
- [ ] Update `WallpaperService.applyWallpaper()` to support `--playlist` flag
- [ ] Create `playlist.ts` tRPC router
- [ ] Register playlist router in main router
- [ ] Update frontend playlists page to use real data
- [ ] Add playlist creation/edit UI
- [ ] Add "Apply Playlist" button to playlist cards
- [ ] Test with multiple monitors
- [ ] Handle edge cases (missing config.json, corrupted JSON, etc.)

---

## Example Usage Flow

### User Perspective:
1. User opens Playlists page
2. Clicks "New Playlist"
3. Names it "Relaxing Wallpapers"
4. Adds 5 wallpapers from library
5. Sets rotation to 30 minutes, random order
6. Clicks "Save"
7. Clicks "Apply to Monitor 1"

### Behind the Scenes:
1. Frontend calls `trpc.playlist.createPlaylist.mutate()`
2. Backend writes to `config.json`:
   ```json
   {
     "steamuser": {
       "general": {
         "playlists": [{
           "name": "Relaxing Wallpapers",
           "items": ["/path/1", "/path/2", ...],
           "settings": {"delay": 30, "order": "random", ...}
         }]
       }
     }
   }
   ```
3. Frontend calls `trpc.playlist.applyPlaylist.mutate({playlistName: "Relaxing Wallpapers", screen: "HDMI-1"})`
4. Backend runs: `linux-wallpaperengine --screen-root HDMI-1 --playlist "Relaxing Wallpapers"`
5. linux-wallpaperengine loads first wallpaper, sets 30-minute timer
6. After 30 minutes, automatically switches to next random wallpaper
7. Continues indefinitely until stopped

---

## Error Handling

### Missing config.json
- Create new config.json with minimal structure
- Or guide user to install Steam's Wallpaper Engine

### Corrupted JSON
- Keep backup before writes
- Restore from backup on parse failure

### Invalid Wallpaper Paths
- Validate paths exist before saving
- Filter out non-existent paths when loading

### Playlist Not Found
- Show clear error: "Playlist 'X' not found in config.json"
- Suggest refreshing playlist list

---

## Future Enhancements

- **Import/Export**: Share playlists as JSON files
- **Smart Playlists**: Auto-populate based on tags/filters
- **Playlist Preview**: Show thumbnails of all wallpapers
- **Nested Playlists**: Playlists that reference other playlists
- **Time-Based Rules**: Different playlists for different times of day
- **Sync**: Sync playlists across machines via cloud storage

---

## References

- linux-wallpaperengine source: `ApplicationContext.cpp`, `WallpaperApplication.cpp`
- Steam Wallpaper Engine config.json location
- `--playlist` flag documentation in `--help` output
