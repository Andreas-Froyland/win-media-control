import { 
  listSessions, 
  play, 
  pause, 
  next, 
  previous, 
  stop, 
  togglePlayPause 
} from '../index.js';

/**
 * Example file demonstrating all win-media-control functions
 * Uncomment the sections you want to test
 */

async function main() {
  console.log('=== Win Media Control Test Examples ===\n');

  // ============================================================================
  // 1. LIST ALL ACTIVE MEDIA SESSIONS
  // ============================================================================
  console.log('1. Listing all active media sessions...');
  const sessions = await listSessions();
  
  if (sessions.length === 0) {
    console.log('No active media sessions found. Start playing something first!');
  } else {
    console.log(`Found ${sessions.length} active session(s):\n`);
    sessions.forEach((session, index) => {
      console.log(`  Session ${index + 1}:`);
      console.log(`    App Name: ${session.appName}`);
      console.log(`    App ID: ${session.appId}`);
      console.log(`    Title: ${session.title || '(no title)'}`);
      console.log(`    Artist: ${session.artist || '(no artist)'}`);
      console.log(`    Status: ${session.playbackStatus}`);
      console.log();
    });
  }

  // ============================================================================
  // 2. CONTROL SPECIFIC APP (Single App)
  // ============================================================================
  // Uncomment to test controlling a specific app
  // Replace 'Spotify' with an app name from your active sessions
  
  // console.log('\n2. Controlling specific app (Spotify)...');
  // const result1 = await play('Spotify');
  // console.log('Result:', result1);
  
  // await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  // console.log('Pausing Spotify...');
  // const result2 = await pause('Spotify');
  // console.log('Result:', result2);

  // ============================================================================
  // 3. CONTROL MULTIPLE APPS
  // ============================================================================
  // Uncomment to test controlling multiple apps at once
  
  // console.log('\n3. Controlling multiple apps...');
  // const result3 = await pause(['Spotify', 'Firefox', 'Chrome']);
  // console.log('Result:', result3);
  // console.log('  Success:', result3.success);
  // console.log('  Failed:', result3.failed);

  // ============================================================================
  // 4. CONTROL ALL SESSIONS
  // ============================================================================
  // Uncomment to test controlling all active media sessions
  
  // console.log('\n4. Pausing all active sessions...');
  // const result4 = await pause('all');
  // console.log('Result:', result4);
  
  // await new Promise(resolve => setTimeout(resolve, 2000));
  
  // console.log('Playing all active sessions...');
  // const result5 = await play('all');
  // console.log('Result:', result5);

  // ============================================================================
  // 5. CONTROL CURRENT/FOCUSED SESSION (No parameters)
  // ============================================================================
  // Uncomment to test controlling the current focused media session
  
  // console.log('\n5. Controlling current/focused session...');
  // console.log('Pausing current session...');
  // const result6 = await pause();
  // console.log('Result:', result6);
  
  // await new Promise(resolve => setTimeout(resolve, 2000));
  
  // console.log('Playing current session...');
  // const result7 = await play();
  // console.log('Result:', result7);

  // ============================================================================
  // 6. TRACK NAVIGATION
  // ============================================================================
  // Uncomment to test next/previous track controls
  
  // console.log('\n6. Track navigation...');
  // console.log('Skipping to next track on Spotify...');
  // const result8 = await next('Spotify');
  // console.log('Result:', result8);
  
  // await new Promise(resolve => setTimeout(resolve, 2000));
  
  // console.log('Going to previous track on Spotify...');
  // const result9 = await previous('Spotify');
  // console.log('Result:', result9);

  // ============================================================================
  // 7. TRACK NAVIGATION (Current Session)
  // ============================================================================
  // Uncomment to test next/previous on current session
  
  // console.log('\n7. Track navigation on current session...');
  // console.log('Next track...');
  // const result10 = await next();
  // console.log('Result:', result10);
  
  // await new Promise(resolve => setTimeout(resolve, 2000));
  
  // console.log('Previous track...');
  // const result11 = await previous();
  // console.log('Result:', result11);

  // ============================================================================
  // 8. STOP PLAYBACK
  // ============================================================================
  // Uncomment to test stop functionality
  
  // console.log('\n8. Stopping playback...');
  // const result12 = await stop('Spotify');
  // console.log('Result:', result12);

  // ============================================================================
  // 9. TOGGLE PLAY/PAUSE
  // ============================================================================
  // Uncomment to test toggle play/pause
  
  // console.log('\n9. Toggle play/pause...');
  // console.log('Toggling Spotify...');
  // const result13 = await togglePlayPause('Spotify');
  // console.log('Result:', result13);
  
  // await new Promise(resolve => setTimeout(resolve, 2000));
  
  // console.log('Toggling again...');
  // const result14 = await togglePlayPause('Spotify');
  // console.log('Result:', result14);

  // ============================================================================
  // 10. TOGGLE CURRENT SESSION
  // ============================================================================
  // Uncomment to test toggle on current session
  
  // console.log('\n10. Toggle current session...');
  // const result15 = await togglePlayPause();
  // console.log('Result:', result15);

  // ============================================================================
  // 11. ERROR HANDLING - Non-existent app
  // ============================================================================
  // Uncomment to see how the library handles non-existent apps
  
  // console.log('\n11. Testing with non-existent app...');
  // const result16 = await play('NonExistentApp');
  // console.log('Result:', result16);
  // console.log('  Success:', result16.success);
  // console.log('  Failed:', result16.failed);

  // ============================================================================
  // 12. MIXED SCENARIO - Some apps exist, some don't
  // ============================================================================
  // Uncomment to test with a mix of valid and invalid app names
  
  // console.log('\n12. Testing with mixed valid/invalid apps...');
  // const result17 = await pause(['Spotify', 'NonExistentApp', 'Firefox']);
  // console.log('Result:', result17);
  // console.log('  Success:', result17.success);
  // console.log('  Failed:', result17.failed);

  console.log('\n=== Test Complete ===');
  console.log('Uncomment sections in the code to test different features!');
}

// Run the main function and handle errors
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

