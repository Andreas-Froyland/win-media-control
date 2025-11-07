/**
 * Represents an active media session
 */
export interface MediaSession {
  /** The application's user model ID (e.g., 'Spotify.exe', 'Firefox.exe') */
  appName: string;
  /** The title of the currently playing media */
  title: string;
  /** The artist of the currently playing media */
  artist: string;
  /** The current playback status ('Playing', 'Paused', 'Stopped', etc.) */
  playbackStatus: string;
}

/**
 * Result object returned by play/pause operations
 */
export interface ControlResult {
  /** Array of app names that were successfully controlled */
  success: string[];
  /** Array of apps that failed with their reasons */
  failed: Array<{
    app: string;
    reason: string;
  }>;
}

/**
 * Lists all active media sessions on the system
 * @returns A promise that resolves to an array of media sessions
 * @example
 * ```typescript
 * const sessions = await listSessions();
 * console.log(sessions);
 * // [{ appName: 'Spotify.exe', title: 'Song Name', artist: 'Artist', playbackStatus: 'Playing' }]
 * ```
 */
export function listSessions(): Promise<MediaSession[]>;

/**
 * Play media for specified app(s)
 * @param apps - A single app name as a string or an array of app names
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await play('Spotify');
 * 
 * // Multiple apps
 * await play(['Spotify', 'Firefox']);
 * ```
 */
export function play(apps: string | string[]): Promise<ControlResult>;

/**
 * Pause media for specified app(s)
 * @param apps - A single app name as a string or an array of app names
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await pause('Spotify');
 * 
 * // Multiple apps
 * await pause(['Spotify', 'Chrome']);
 * ```
 */
export function pause(apps: string | string[]): Promise<ControlResult>;

/**
 * Play all active media sessions
 * @returns A promise that resolves to a result object indicating success/failure for each session
 * @example
 * ```typescript
 * await globalPlay();
 * ```
 */
export function globalPlay(): Promise<ControlResult>;

/**
 * Pause all active media sessions
 * @returns A promise that resolves to a result object indicating success/failure for each session
 * @example
 * ```typescript
 * await globalPause();
 * ```
 */
export function globalPause(): Promise<ControlResult>;

