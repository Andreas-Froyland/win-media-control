import { 
  listSessions, 
  play, 
  pause, 
  next, 
  previous, 
  stop, 
  togglePlayPause 
} from '../index.js';

async function testListSessions() {
  const sessions = await listSessions();
  console.log(sessions);
}

async function testPlay(app) {
  const result = await play(app);
  console.log(result);
}

async function testPause(app) {
  const result = await pause(app);
  console.log(result);
}

async function testNext(app) {
  const result = await next(app);
  console.log(result);
}

async function testPrevious(app) {
  const result = await previous(app);
  console.log(result);
}

async function testStop(app) {
  const result = await stop(app);
  console.log(result);
}

async function testTogglePlayPause(app) {
  const result = await togglePlayPause(app);
  console.log(result);
}

async function main() {
  await testListSessions();
  
  // await testPlay('Spotify');
  // await testPlay(['Spotify', 'Firefox']);
  // await testPlay('all');
  // await testPlay();
  
  // await testPause('Spotify');
  // await testPause(['Spotify', 'Firefox']);
  // await testPause('all');
  // await testPause();
  
  // await testNext('Spotify');
  // await testNext();
  
  // await testPrevious('Spotify');
  // await testPrevious();
  
  // await testStop('Spotify');
  // await testStop();
  
  // await testTogglePlayPause('Spotify');
  // await testTogglePlayPause();
}

main().catch(console.error);

