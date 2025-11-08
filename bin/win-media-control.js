#!/usr/bin/env node

import { play, pause, next, previous, stop, togglePlayPause, listSessions } from '../index.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Display help menu
 */
function showHelp() {
  console.log(`
${colors.bright}win-media-control${colors.reset} - Control Windows media playback

${colors.cyan}USAGE:${colors.reset}
  win-media-control <command> [apps...]

${colors.cyan}COMMANDS:${colors.reset}
  ${colors.green}play [app1|all] [app2...]${colors.reset}     Play media for app(s), "all" for all sessions, or control current session if omitted
  ${colors.green}pause [app1|all] [app2...]${colors.reset}    Pause media for app(s), "all" for all sessions, or control current session if omitted
  ${colors.green}next [app1] [app2...]${colors.reset}         Skip next for app(s), or control current session if omitted
  ${colors.green}previous [app1] [app2...]${colors.reset}     Skip previous for app(s), or control current session if omitted
  ${colors.green}stop [app1] [app2...]${colors.reset}         Stop playback for app(s), or control current session if omitted
  ${colors.green}toggle [app1] [app2...]${colors.reset}       Toggle play/pause for app(s), or control current session if omitted
  ${colors.green}list${colors.reset}                          List all active media sessions

${colors.cyan}OPTIONS:${colors.reset}
  -h, --help                 Show this help menu
  -v, --version              Show version number

${colors.cyan}EXAMPLES:${colors.reset}
  ${colors.gray}# Pause Spotify${colors.reset}
  win-media-control pause Spotify

  ${colors.gray}# Control current/focused media session${colors.reset}
  win-media-control play
  win-media-control next

  ${colors.gray}# Play all sessions${colors.reset}
  win-media-control play all

  ${colors.gray}# Play multiple apps${colors.reset}
  win-media-control play Spotify Firefox

  ${colors.gray}# List active sessions${colors.reset}
  win-media-control list

${colors.cyan}DEBUG MODE:${colors.reset}
  Set DEBUG=win-media-control to enable verbose logging
  ${colors.gray}Example: DEBUG=win-media-control win-media-control pause Spotify${colors.reset}
`);
}

/**
 * Display formatted result
 */
function displayResult(result) {
  if (result.success && result.success.length > 0) {
    console.log(`${colors.green}✓${colors.reset} Success:`, result.success.join(', '));
  }
  
  if (result.failed && result.failed.length > 0) {
    console.log(`${colors.yellow}⚠${colors.reset} Failed:`);
    result.failed.forEach(({ app, reason }) => {
      console.log(`  ${colors.red}✗${colors.reset} ${app}: ${reason}`);
    });
  }
}

/**
 * Display media sessions in a formatted table
 */
function displaySessions(sessions) {
  if (sessions.length === 0) {
    console.log(`${colors.yellow}No active media sessions found${colors.reset}`);
    return;
  }
  
  console.log(`\n${colors.bright}Active Media Sessions:${colors.reset}\n`);
  
  sessions.forEach((session, index) => {
    console.log(`${colors.cyan}${index + 1}.${colors.reset} ${colors.bright}${session.appName}${colors.reset}`);
    if (session.title) {
      console.log(`   Title:  ${session.title}`);
    }
    if (session.artist) {
      console.log(`   Artist: ${session.artist}`);
    }
    console.log(`   Status: ${session.playbackStatus === 'Playing' ? colors.green : colors.gray}${session.playbackStatus}${colors.reset}`);
    console.log();
  });
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  // Check for version flag
  if (args.includes('-v') || args.includes('--version')) {
    // Read version from package.json
    const { readFile } = await import('fs/promises');
    const { dirname, join } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', 'package.json');
    
    try {
      const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
      console.log(packageJson.version);
    } catch (error) {
      console.log('1.0.0');
    }
    process.exit(0);
  }
  
  const command = args[0].toLowerCase();
  const apps = args.slice(1);
  
  try {
    switch (command) {
      case 'play': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await play();
          displayResult(result);
        } else if (apps.length === 1 && apps[0].toLowerCase() === 'all') {
          console.log(`${colors.cyan}Playing all media sessions...${colors.reset}`);
          const result = await play('all');
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Playing media for:${colors.reset} ${apps.join(', ')}`);
          const result = await play(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'pause': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await pause();
          displayResult(result);
        } else if (apps.length === 1 && apps[0].toLowerCase() === 'all') {
          console.log(`${colors.cyan}Pausing all media sessions...${colors.reset}`);
          const result = await pause('all');
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Pausing media for:${colors.reset} ${apps.join(', ')}`);
          const result = await pause(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'next': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await next();
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Skipping to next track for:${colors.reset} ${apps.join(', ')}`);
          const result = await next(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'previous': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await previous();
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Skipping to previous track for:${colors.reset} ${apps.join(', ')}`);
          const result = await previous(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'stop': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await stop();
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Stopping playback for:${colors.reset} ${apps.join(', ')}`);
          const result = await stop(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'toggle': {
        if (apps.length === 0) {
          console.log(`${colors.cyan}Controlling current media session...${colors.reset}`);
          const result = await togglePlayPause();
          displayResult(result);
        } else {
          console.log(`${colors.cyan}Toggling play/pause for:${colors.reset} ${apps.join(', ')}`);
          const result = await togglePlayPause(apps);
          displayResult(result);
        }
        break;
      }
      
      case 'list': {
        const sessions = await listSessions();
        displaySessions(sessions);
        break;
      }
      
      default: {
        console.error(`${colors.red}Error: Unknown command "${command}"${colors.reset}`);
        console.log(`${colors.gray}Run 'win-media-control --help' for usage information${colors.reset}`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

main();

