/**
 * Represents an active media session
 */
export interface MediaSession {
  /** The friendly application name (e.g., 'Spotify', 'Mozilla Firefox', 'Google Chrome') */
  appName: string;
  /** The application's source ID from Windows (package ID or exe name) */
  appId: string;
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
 * Play media for specified app(s), all sessions, or control current session
 * @param apps - A single app name, array of app names, or "all" for all sessions. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await play('Spotify');
 * 
 * // Multiple apps
 * await play(['Spotify', 'Firefox']);
 * 
 * // All sessions
 * await play('all');
 * 
 * // Control current session
 * await play();
 * ```
 */
export function play(apps?: string | string[]): Promise<ControlResult>;

/**
 * Pause media for specified app(s), all sessions, or control current session
 * @param apps - A single app name, array of app names, or "all" for all sessions. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await pause('Spotify');
 * 
 * // Multiple apps
 * await pause(['Spotify', 'Chrome']);
 * 
 * // All sessions
 * await pause('all');
 * 
 * // Control current session
 * await pause();
 * ```
 */
export function pause(apps?: string | string[]): Promise<ControlResult>;

/**
 * Skip to next track for specified app(s) or control current session
 * @param apps - A single app name as a string or an array of app names. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await next('Spotify');
 * 
 * // Multiple apps
 * await next(['Spotify', 'Firefox']);
 * 
 * // Control current session
 * await next();
 * ```
 */
export function next(apps?: string | string[]): Promise<ControlResult>;

/**
 * Skip to previous track for specified app(s) or control current session
 * @param apps - A single app name as a string or an array of app names. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await previous('Spotify');
 * 
 * // Multiple apps
 * await previous(['Spotify', 'Firefox']);
 * 
 * // Control current session
 * await previous();
 * ```
 */
export function previous(apps?: string | string[]): Promise<ControlResult>;

/**
 * Stop playback for specified app(s) or control current session
 * @param apps - A single app name as a string or an array of app names. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await stop('Spotify');
 * 
 * // Multiple apps
 * await stop(['Spotify', 'Chrome']);
 * 
 * // Control current session
 * await stop();
 * ```
 */
export function stop(apps?: string | string[]): Promise<ControlResult>;

/**
 * Toggle play/pause for specified app(s) or control current session
 * @param apps - A single app name as a string or an array of app names. If omitted, controls the current/focused media session.
 * @returns A promise that resolves to a result object indicating success/failure for each app
 * @example
 * ```typescript
 * // Single app
 * await togglePlayPause('Spotify');
 * 
 * // Multiple apps
 * await togglePlayPause(['Spotify', 'Firefox']);
 * 
 * // Control current session
 * await togglePlayPause();
 * ```
 */
export function togglePlayPause(apps?: string | string[]): Promise<ControlResult>;

