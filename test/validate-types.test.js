import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('Running TypeScript definitions validation tests...\n');

let testsRun = 0;
let testsPassed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    process.exitCode = 1;
  }
}

// Read the main module and type definitions
const indexPath = join(rootDir, 'index.js');
const typesPath = join(rootDir, 'index.d.ts');

const indexContent = readFileSync(indexPath, 'utf8');
const typesContent = readFileSync(typesPath, 'utf8');

// Extract exported functions from index.js
const exportMatches = indexContent.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
const exportedFunctions = Array.from(exportMatches, m => m[1]);

test('index.js exports functions', () => {
  assert.ok(exportedFunctions.length > 0, 'index.js should export at least one function');
});

// Check each exported function has a type definition
exportedFunctions.forEach(funcName => {
  test(`TypeScript definition exists for exported function "${funcName}"`, () => {
    const declarationPattern = new RegExp(`export\\s+function\\s+${funcName}\\s*\\(`);
    assert.ok(
      declarationPattern.test(typesContent),
      `Type definition for function "${funcName}" not found in index.d.ts`
    );
  });
});

// Check that type definitions file has proper structure
test('index.d.ts has proper TypeScript module structure', () => {
  // Should have export statements
  assert.ok(
    /export\s+function/.test(typesContent) || /export\s+interface/.test(typesContent) || /export\s+type/.test(typesContent),
    'index.d.ts should contain export statements'
  );
});

// Check that common types are defined
test('MediaSession interface is defined', () => {
  assert.ok(
    /interface\s+MediaSession/.test(typesContent) || /type\s+MediaSession/.test(typesContent),
    'MediaSession type should be defined'
  );
});

test('ControlResult interface is defined', () => {
  assert.ok(
    /interface\s+ControlResult/.test(typesContent) || /type\s+ControlResult/.test(typesContent),
    'ControlResult type should be defined'
  );
});

// Check that the types file doesn't have obvious syntax errors
test('index.d.ts has no obvious syntax errors', () => {
  // Check for balanced braces
  const openBraces = (typesContent.match(/\{/g) || []).length;
  const closeBraces = (typesContent.match(/\}/g) || []).length;
  assert.strictEqual(openBraces, closeBraces, 'Braces should be balanced');
  
  // Check for balanced parentheses
  const openParens = (typesContent.match(/\(/g) || []).length;
  const closeParens = (typesContent.match(/\)/g) || []).length;
  assert.strictEqual(openParens, closeParens, 'Parentheses should be balanced');
});

// Verify that listSessions is exported
test('listSessions function is exported and typed', () => {
  assert.ok(
    /export\s+function\s+listSessions/.test(typesContent),
    'listSessions should be exported in type definitions'
  );
});

// Verify control functions are exported
const controlFunctions = ['play', 'pause', 'next', 'previous', 'stop', 'togglePlayPause'];
controlFunctions.forEach(funcName => {
  test(`${funcName} function is exported and typed`, () => {
    assert.ok(
      new RegExp(`export\\s+function\\s+${funcName}`).test(typesContent),
      `${funcName} should be exported in type definitions`
    );
  });
});

// Summary
console.log(`\n${testsPassed}/${testsRun} tests passed`);
if (testsPassed !== testsRun) {
  process.exit(1);
}

