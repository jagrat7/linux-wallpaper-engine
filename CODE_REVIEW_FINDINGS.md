# Code Review: Display Management Features

## Critical Issues Found

### 1. **Undefined Reference Bug in display.ts**
**Location**: `src/main/services/display.ts:169-170`, `src/main/services/display.ts:219-220`
```typescript
const fallbackRefreshRate = settingsService.getSetting('maxRefreshRate')
  ?? settingsService.getSetting('fps')
```
**Issue**: `settingsService.getSetting()` can return `undefined` for both keys, but `refreshRate` expects a number. This will cause `undefined` to be assigned as the refresh rate.

**Fix**: Provide a default fallback value:
```typescript
const fallbackRefreshRate = settingsService.getSetting('maxRefreshRate')
  ?? settingsService.getSetting('fps')
  ?? 60
```

### 2. **Mutation State Bug in display.ts**
**Location**: `src/main/trpc/routes/display.ts:29-31`, `src/main/trpc/routes/display.ts:39-41`
```typescript
const overrides = settingsService.getSetting('displayNameOverrides')
overrides[input.displayId] = input.name
settingsService.setSetting('displayNameOverrides', overrides)
```
**Issue**: Direct mutation of the settings object. If `displayNameOverrides` is `undefined` or `null`, this will throw a runtime erro

**Fix**: Ensure we always work with a valid object:
```typescript
const overrides = settingsService.getSetting('displayNameOverrides') || {}
overrides[input.displayId] = input.name
settingsService.setSetting('displayNameOverrides', overrides)
```

## Potential Issues

### 3. **Race Condition in displays.tsx**
**Location**: `src/renderer/routes/displays.tsx:57`
```typescript
const active = activeWallpapers.find(w => w.screen === d.name)
```
**Issue**: Uses `d.name` (which may be overridden) instead of `d.id` for matching wallpapers. If a user renames a display, existing wallpapers may not be found.

**Recommendation**: Consider using `d.id` for matching or maintain a mapping of both ID and name.

### 4. **Resource Leak in display.ts**
**Location**: `src/main/services/display.ts:181`, `src/main/services/display.ts:187`
**Issue**: Multiple `fs.readFile()` calls in loops without proper error handling or resource cleanup. While Node.js handles this, it could be optimized.

### 5. **Inconsistent Error Handling**
**Location**: Throughout `displayService.detectDisplays()`
**Issue**: Some catch blocks are empty, which can mask important errors. At minimum, these should log the error for debugging.

## Minor Issues

### 6. **Type Safety**
**Location**: `src/main/services/display.ts:239`
```typescript
const overrides = settingsService.getSetting('displayNameOverrides')
```
**Issue**: No type checking that `overrides` is actually a `Record<string, string>`.

### 7. **Performance Concern**
**Location**: `src/main/services/display.ts:260-262`
```typescript
async getMaxRefreshRate(): Promise<number> {
  const displays = await displayService.detectDisplays()
  const maxRate = Math.max(...displays.map(d => d.refreshRate))
  return maxRate
}
```
**Issue**: Calls `detectDisplays()` which runs multiple external commands. This could be cached.

## Security Considerations

### 8. **Path Traversal Risk**
**Location**: `src/main/services/display.ts:180`
```typescript
const entryPath = path.join(drmPath, entry)
```
**Issue**: While the path is constructed from a controlled directory, ensure `entry` doesn't contain directory traversal characters. The regex pattern helps but isn't foolproof.

## Recommendations

1. **Add null checks and default values** for all settings access
2. **Implement proper error logging** in catch blocks
3. **Consider caching display detection results** for performance
4. **Add input validation** for display names (prevent special characters that might break shell commands)
5. **Use defensive programming** when working with user settings

The code is generally well-structured and follows good patterns, but these issues should be addressed to improve robustness and prevent runtime errors.
