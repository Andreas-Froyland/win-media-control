# win-media-control

Control Windows media playback programmatically using PowerShell commands. Works with any app that supports Windows' System Media Transport Controls (Spotify, Chrome, Firefox, Edge, VLC, and more).

## Features

- **Control any media app** - Works with Spotify, browsers, media players, etc.
- **Simple async/await API** - Modern Promise-based interface
- **Zero dependencies** - Uses built-in Node.js modules
- **TypeScript support** - Full type definitions included
- **CLI tool included** - Control media from command line
- **Debug mode** - Verbose logging for troubleshooting
- **Smart error handling** - Warns on failures but continues with other apps

## Requirements

- **Windows 10/11** - Uses Windows Runtime APIs
- **Node.js 14+** - ES6 module support required

## Installation

```bash
npm install win-media-control
```

## API Usage

### Import

```javascript
import { play, pause, globalPlay, globalPause, listSessions } from 'win-media-control';
```

### List Active Media Sessions

Get all active media sessions with their current state:

```javascript
const sessions = await listSessions();
console.log(sessions);
// Output:
// [
//   {
//     appName: 'Spotify',           // Friendly name
//     appId: 'Spotify.exe',          // Windows source ID  
//     title: 'Song Title',
//     artist: 'Artist Name',
//     playbackStatus: 'Playing'
//   },
//   {
//     appName: 'Mozilla Firefox',
//     appId: 'firefox.exe',
//     title: 'Video Title',
//     artist: '',
//     playbackStatus: 'Paused'
//   }
// ]
```

**Note:** The package uses the same approach as Windows' media overlay - it retrieves the **FileDescription** from the running process. Firefox tabs are automatically detected even when Windows assigns cryptic session IDs.

### Play Media

Play media for specific app(s):

```javascript
// Single app (string)
await play('Spotify');

// Multiple apps (array)
await play(['Spotify', 'Firefox']);

// All browsers show friendly names
await play('Firefox');        // Controls Firefox
await play('Google Chrome');  // Controls Chrome
await play('Microsoft Edge'); // Controls Edge

// Returns result object
const result = await play(['Spotify', 'Chrome']);
console.log(result);
// {
//   success: ['Spotify', 'Google Chrome'],
//   failed: []
// }
```

### Pause Media

Pause media for specific app(s):

```javascript
// Single app
await pause('Spotify');

// Multiple apps
await pause(['Spotify', 'Firefox', 'Chrome']);
```

### Global Controls

Control all active media sessions at once:

```javascript
// Play all media
await globalPlay();

// Pause all media
await globalPause();
```

### Complete Example

```javascript
import { listSessions, play, pause, globalPause } from 'win-media-control';

async function main() {
  // List what's currently playing
  const sessions = await listSessions();
  console.log('Active sessions:', sessions);

  // Pause all media
  await globalPause();

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Resume Spotify only
  await play('Spotify');
}

main();
```

## CLI Usage

The package includes a command-line tool for quick media control:

### Commands

```bash
# Play specific app(s)
npx win-media-control play Spotify
npx win-media-control play Spotify Firefox Chrome

# Pause specific app(s)
npx win-media-control pause Spotify
npx win-media-control pause Firefox Chrome

# Control all media sessions
npx win-media-control globalPlay
npx win-media-control globalPause

# List active media sessions
npx win-media-control list

# Show help
npx win-media-control --help

# Show version
npx win-media-control --version
```

### Global Installation

For easier access, install globally:

```bash
npm install -g win-media-control

# Now use without npx
win-media-control pause Spotify
win-media-control list
```

## Debug Mode

Enable verbose logging to troubleshoot issues:

```bash
# On Windows (PowerShell)
$env:DEBUG="win-media-control"
node your-script.js

# On Windows (CMD)
set DEBUG=win-media-control
node your-script.js

# Or inline with the CLI
DEBUG=win-media-control npx win-media-control pause Spotify
```

Debug mode shows:
- PowerShell commands being executed
- Found media sessions
- Success/failure details for each operation

## Error Handling

The library uses a **warn-and-continue** approach:

- If an app isn't found, it logs a warning and continues with other apps
- Returns a result object with `success` and `failed` arrays
- Never throws errors for missing apps (only for critical failures)

```javascript
const result = await pause(['Spotify', 'NonExistentApp', 'Firefox']);
// Console output:
// Warning: No media session found for "NonExistentApp". Available apps: Spotify.exe, firefox.exe

console.log(result);
// {
//   success: ['Spotify.exe', 'firefox.exe'],
//   failed: [{ app: 'NonExistentApp', reason: 'Session not found' }]
// }
```

## TypeScript

Full TypeScript support with type definitions included:

```typescript
import { 
  play, 
  pause, 
  listSessions, 
  MediaSession, 
  ControlResult 
} from 'win-media-control';

const sessions: MediaSession[] = await listSessions();
const result: ControlResult = await play('Spotify');
```

### Type Definitions

```typescript
interface MediaSession {
  appName: string;
  title: string;
  artist: string;
  playbackStatus: string;
}

interface ControlResult {
  success: string[];
  failed: Array<{
    app: string;
    reason: string;
  }>;
}
```

## How It Works

This package uses Windows' **System Media Transport Controls** (SMTC) through PowerShell and the Windows Runtime APIs. Any app that integrates with Windows' media controls (the popup that appears when you press media keys) can be controlled.

**Supported apps include:**
- **Desktop apps:** Spotify, VLC Media Player, Windows Media Player, iTunes
- **Browsers:** Chrome, Firefox, Edge, Opera, Brave (displays as "Google Chrome", "Firefox", "Microsoft Edge", etc.)
- **Any app** that integrates with Windows Media Transport Controls

The package uses the same name resolution as Windows' built-in media overlay.

### Why Firefox Needs Special Handling

Firefox generates dynamic session IDs (like `308046B0AF4A39CB`) for browser tabs playing media, rather than using a standard Windows Application User Model ID (AUMID). This is different from Chrome and Edge, which properly register their session IDs (`Chrome`, `MSEdge`).

When we detect a cryptic session ID that doesn't match any running process, we check if Firefox is running and label it accordingly.

### Found an App That Doesn't Work?

If you encounter an application that doesn't appear in the session list or can't be controlled, please [create an issue](https://github.com/YOUR_USERNAME/win-media-control/issues) with:
- The app name and version
- What shows up when you run `npx win-media-control list`
- Whether the app works with Windows' built-in media controls (media keys/overlay)

This helps us improve detection for apps with non-standard session IDs!

## Common Issues

### "No active media sessions found"

**Cause:** No apps are currently playing or paused media.

**Solution:** Start playing media in any supported app first.

### "Session not found for [app]"

**Cause:** The app name doesn't match any active session.

**Solutions:**
1. Run `npx win-media-control list` to see exact app names
2. Use partial names (e.g., "Spotify" matches "Spotify.exe")
3. App names are case-insensitive

### PowerShell execution errors

**Cause:** PowerShell execution policies or permissions.

**Solution:** Ensure PowerShell can execute scripts. Run PowerShell as administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

