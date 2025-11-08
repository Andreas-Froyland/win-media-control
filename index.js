import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const DEBUG = process.env.DEBUG === 'win-media-control';

/**
 * Log debug messages when DEBUG mode is enabled
 */
function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Execute a PowerShell script file with arguments
 */
async function executePowerShell(scriptName, params = {}) {
  // Get absolute path to script relative to this module
  const scriptPath = fileURLToPath(new URL(`./scripts/${scriptName}`, import.meta.url));
  
  // Check if we have array parameters - if so, use -Command instead of -File
  const hasArrayParams = Object.values(params).some(v => Array.isArray(v));
  
  let command;
  if (hasArrayParams) {
    // Use -Command for proper array handling
    const paramParts = [];
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        // Build PowerShell array syntax: @('val1','val2')
        const arrayValues = value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',');
        paramParts.push(`-${key} @(${arrayValues})`);
      } else {
        const escaped = String(value).replace(/'/g, "''");
        paramParts.push(`-${key} '${escaped}'`);
      }
    }
    const paramsString = paramParts.join(' ');
    command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& '${scriptPath.replace(/'/g, "''")}' ${paramsString}"`;
  } else {
    // Use -File for simpler execution without arrays
    const paramParts = [];
    for (const [key, value] of Object.entries(params)) {
      const escaped = String(value).replace(/"/g, '`"');
      if (escaped.includes(' ') || escaped.includes('&') || escaped.includes('|')) {
        paramParts.push(`-${key} "${escaped}"`);
      } else {
        paramParts.push(`-${key} ${escaped}`);
      }
    }
    command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" ${paramParts.join(' ')}`;
  }
  
  debug('Executing PowerShell script:', scriptName, params);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      windowsHide: true,
      timeout: 10000
    });
    
    if (stderr && DEBUG) {
      debug('PowerShell stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    debug('PowerShell error:', error.message);
    throw new Error(`PowerShell execution failed: ${error.message}`);
  }
}

/**
 * Ensure value is an array
 */
function ensureArray(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * Get all active media sessions
 */
export async function listSessions() {
  try {
    const output = await executePowerShell('list-sessions.ps1');
    
    if (!output || output === 'null' || output === '') {
      debug('No active media sessions found');
      return [];
    }
    
    const sessions = ensureArray(JSON.parse(output));
    debug('Found sessions:', sessions);
    return sessions;
  } catch (error) {
    debug('Error listing sessions:', error.message);
    return [];
  }
}

/**
 * Control media playback for specific apps or all apps
 */
async function controlMedia(apps, action) {
  // Normalize input to array
  const appList = apps === "all" ? null : (Array.isArray(apps) ? apps : [apps]);
  
  debug(`Attempting to ${action}:`, apps === "all" ? "all sessions" : appList);
  
  const result = {
    success: [],
    failed: []
  };
  
  try {
    // Build parameters for PowerShell script
    const params = { Action: action };
    if (appList) {
      params.SearchPatterns = appList;
    }
    
    const output = await executePowerShell('control-media.ps1', params);
    
    if (!output || output === 'null' || output === '') {
      console.warn('Warning: No active media sessions found');
      if (appList) {
        for (const app of appList) {
          result.failed.push({ app, reason: 'No active media sessions' });
        }
      }
      return result;
    }
    
    const psResult = JSON.parse(output);
    
    // Mark controlled apps as successful
    if (psResult.controlled && psResult.controlled.length > 0) {
      const controlled = ensureArray(psResult.controlled);
      result.success.push(...controlled);
      controlled.forEach(app => debug(`Successfully ${action.toLowerCase()}ed:`, app));
    }
    
    // Mark apps that weren't found
    if (psResult.notFound && psResult.notFound.length > 0) {
      const notFound = ensureArray(psResult.notFound);
      const available = ensureArray(psResult.available);
      notFound.forEach(app => {
        console.warn(`Warning: No media session found for "${app}". Available apps: ${available.join(', ')}`);
        result.failed.push({ app, reason: 'Session not found' });
      });
    }
    
    // Handle apps that were found but failed to control
    if (appList) {
      for (const app of appList) {
        const wasControlled = result.success.some(name => 
          name.toLowerCase().includes(app.toLowerCase())
        );
        const wasNotFound = psResult.notFound && 
          ensureArray(psResult.notFound).includes(app.toLowerCase());
        
        if (!wasControlled && !wasNotFound) {
          console.warn(`Warning: Failed to ${action.toLowerCase()} "${app}"`);
          result.failed.push({ app, reason: 'Control command failed' });
        }
      }
    }
    
  } catch (error) {
    debug('Control script failed:', error.message);
    if (appList) {
      for (const app of appList) {
        console.warn(`Warning: Failed to ${action.toLowerCase()} "${app}": ${error.message}`);
        result.failed.push({ app, reason: error.message });
      }
    } else {
      console.warn(`Warning: Failed to ${action.toLowerCase()} all sessions: ${error.message}`);
    }
  }
  
  return result;
}

/**
 * Play media for specified app(s), all sessions, or control current session
 * @param {string|string[]} [apps] - App name, array of app names, or "all" for all sessions. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function play(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Play');
  }
  return controlMedia(apps, 'Play');
}

/**
 * Pause media for specified app(s), all sessions, or control current session
 * @param {string|string[]} [apps] - App name, array of app names, or "all" for all sessions. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function pause(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Pause');
  }
  return controlMedia(apps, 'Pause');
}

/**
 * Skip to next track for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function next(apps) {
  if (apps === undefined) {
    return controlCurrentSession('SkipNext');
  }
  return controlMedia(apps, 'SkipNext');
}

/**
 * Skip to previous track for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function previous(apps) {
  if (apps === undefined) {
    return controlCurrentSession('SkipPrevious');
  }
  return controlMedia(apps, 'SkipPrevious');
}

/**
 * Stop playback for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function stop(apps) {
  if (apps === undefined) {
    return controlCurrentSession('Stop');
  }
  return controlMedia(apps, 'Stop');
}

/**
 * Toggle play/pause for specified app(s) or control current session
 * @param {string|string[]} [apps] - App name or array of app names. If omitted, controls current session.
 * @returns {Promise<{success: string[], failed: Array<{app: string, reason: string}>}>}
 */
export async function togglePlayPause(apps) {
  if (apps === undefined) {
    return controlCurrentSession('TogglePlayPause');
  }
  return controlMedia(apps, 'TogglePlayPause');
}

/**
 * Control the current/default media session
 */
async function controlCurrentSession(action) {
  debug(`Controlling current session with action: ${action}`);
  
  try {
    await executePowerShell('control-current.ps1', { Action: action });
    return { success: ['Current Session'], failed: [] };
  } catch (error) {
    debug(`Failed to control current session, falling back to SendKeys:`, error.message);
    // Fallback to SendKeys method
    return simulateMediaKeyWithSendKeys(action);
  }
}

/**
 * Simulate media key press using SendKeys via PowerShell
 */
async function simulateMediaKeyWithSendKeys(action) {
  debug(`Simulating media key for action: ${action} using SendKeys`);
  
  try {
    await executePowerShell('simulate-media-key.ps1', { Action: action });
    return { success: [action], failed: [] };
  } catch (error) {
    debug(`Failed to simulate media key:`, error.message);
    return { success: [], failed: [{ app: 'MediaKey', reason: error.message }] };
  }
}
