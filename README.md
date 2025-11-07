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
import { play, pause, globalPlay, globalPause, listSessions } from 'win-media-control';
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
await play('Spotify');
await pause('Firefox');

// Multiple apps
await play(['Spotify', 'Firefox']);

// All active sessions
await globalPlay();
await globalPause();
```

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
npx win-media-control play Spotify
npx win-media-control pause Firefox Chrome
npx win-media-control globalPause
npx win-media-control list
```

Install globally to drop the `npx`:

```bash
npm install -g win-media-control
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
import { MediaSession, ControlResult } from 'win-media-control';

const sessions: MediaSession[] = await listSessions();
const result: ControlResult = await play('Spotify');
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

## License

MIT

