# win-media-control

Node.js package for controlling Windows media playback. Works with Spotify, browsers (Chrome, Firefox, Edge), and any other app that integrates with Windows media controls.

Uses PowerShell to interact with Windows' System Media Transport Controls API.

## Installation

```bash
npm install win-media-control
```

Requires Windows 10/11 and Node.js 14+.

## Usage

```javascript
import { play, pause, next, previous, stop, togglePlayPause, listSessions } from 'win-media-control';
```

### List active sessions

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

Firefox tabs are automatically detected even when they use cryptic session IDs.

### Control playback

```javascript
// Control specific apps
await play('Spotify');
await pause('Firefox');
await stop('Chrome');

// Track navigation
await next('Spotify');
await previous('Spotify');

// Toggle play/pause
await togglePlayPause('Firefox');

// Multiple apps
await play(['Spotify', 'Firefox']);
await next(['Spotify', 'Chrome']);

// Omit app parameter to control all sessions or simulate keyboard keys
await play();         // Play all active sessions
await pause();        // Pause all active sessions
await next();         // Simulate Next Track keyboard key (Windows decides which session)
await previous();     // Simulate Previous Track keyboard key
await stop();         // Simulate Stop keyboard key
await togglePlayPause(); // Simulate Play/Pause Toggle keyboard key
```

When you call `next()`, `previous()`, `stop()`, or `togglePlayPause()` without arguments, they simulate pressing media keyboard keys. Windows decides which session to control (typically the most recently active one). This matches the behavior of physical multimedia keyboards.

When you call `play()` or `pause()` without arguments, they control all active sessions.

Functions return a result object with `success` and `failed` arrays:

```javascript
const result = await pause(['Spotify', 'NonExistentApp']);
console.log(result);
// {
//   success: ['Spotify'],
//   failed: [{ app: 'NonExistentApp', reason: 'Session not found' }]
// }
```

## CLI

```bash
# Control specific apps
npx win-media-control play Spotify
npx win-media-control pause Firefox Chrome
npx win-media-control next Spotify

# Control all sessions (play/pause) or simulate keyboard keys (next/previous/stop/toggle)
npx win-media-control pause
npx win-media-control next
npx win-media-control toggle

npx win-media-control list
```

Install globally to drop the `npx`:

```bash
npm install -g win-media-control
win-media-control next
win-media-control pause Spotify
```

## Debug

Set `DEBUG=win-media-control` to see what PowerShell commands are being run:

```bash
$env:DEBUG="win-media-control"
node your-script.js
```

## TypeScript

Type definitions are included:

```typescript
import { MediaSession, ControlResult, next } from 'win-media-control';

const sessions: MediaSession[] = await listSessions();

// Control specific app
const result: ControlResult = await next('Spotify');

// Simulate keyboard key
await next();
```

## How it works

Uses Windows' System Media Transport Controls API via PowerShell. Works with any app that integrates with Windows media controls (Spotify, VLC, browsers, etc).

App names are resolved by checking the running process's FileDescription metadata.

### Firefox quirk

Firefox uses dynamic session IDs like `308046B0AF4A39CB` instead of a standard app identifier. When we see a cryptic ID that doesn't match a process, we check if Firefox is running.

### Issues

If an app doesn't work, open an issue with the app name and what `npx win-media-control list` shows.

## Troubleshooting

**No sessions found:** Make sure something is actually playing media.

**App not found:** Run `npx win-media-control list` to see available apps. Names are case-insensitive and partial matches work.

**PowerShell errors:** You might need to allow script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Coming Later

These features could be added if there's interest:

- Seek/scrub to specific position
- Fast forward/rewind
- Playback rate adjustment
- Shuffle toggle
- Repeat mode control
- Volume control
- Get current position/duration
- Album art retrieval
- Timeline properties

Open an issue if you'd like any of these features.

## License

MIT

