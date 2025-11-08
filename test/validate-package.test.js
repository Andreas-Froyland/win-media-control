import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('Running package.json validation tests...\n');

// Read package.json
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

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

// Test required fields exist
test('package.json has required name field', () => {
  assert.ok(packageJson.name, 'name field is required');
  assert.strictEqual(typeof packageJson.name, 'string', 'name must be a string');
});

test('package.json has required version field', () => {
  assert.ok(packageJson.version, 'version field is required');
  assert.match(packageJson.version, /^\d+\.\d+\.\d+/, 'version must be semver format');
});

test('package.json has required description field', () => {
  assert.ok(packageJson.description, 'description field is required');
  assert.strictEqual(typeof packageJson.description, 'string', 'description must be a string');
});

test('package.json has required main field', () => {
  assert.ok(packageJson.main, 'main field is required');
  assert.strictEqual(typeof packageJson.main, 'string', 'main must be a string');
});

test('package.json has required license field', () => {
  assert.ok(packageJson.license, 'license field is required');
  assert.strictEqual(typeof packageJson.license, 'string', 'license must be a string');
});

// Test that main file exists
test('main entry point file exists', () => {
  const mainPath = join(rootDir, packageJson.main);
  assert.ok(existsSync(mainPath), `main file ${packageJson.main} must exist`);
});

// Test that types file exists
test('types file exists', () => {
  assert.ok(packageJson.types, 'types field should be defined');
  const typesPath = join(rootDir, packageJson.types);
  assert.ok(existsSync(typesPath), `types file ${packageJson.types} must exist`);
});

// Test that bin files exist
test('bin files exist', () => {
  assert.ok(packageJson.bin, 'bin field should be defined');
  for (const [name, path] of Object.entries(packageJson.bin)) {
    const binPath = join(rootDir, path);
    assert.ok(existsSync(binPath), `bin file ${path} for command '${name}' must exist`);
  }
});

// Test that bin files have proper shebang
test('bin files have proper shebang', () => {
  for (const [name, path] of Object.entries(packageJson.bin)) {
    const binPath = join(rootDir, path);
    const content = readFileSync(binPath, 'utf8');
    assert.ok(
      content.startsWith('#!/usr/bin/env node'),
      `bin file ${path} must start with #!/usr/bin/env node shebang`
    );
  }
});

// Test that all files in "files" field exist
test('all files listed in "files" field exist', () => {
  assert.ok(packageJson.files, 'files field should be defined');
  assert.ok(Array.isArray(packageJson.files), 'files field must be an array');
  
  for (const file of packageJson.files) {
    const filePath = join(rootDir, file);
    assert.ok(
      existsSync(filePath),
      `file or directory '${file}' listed in files field must exist`
    );
  }
});

// Test engine constraints
test('engines field specifies Node.js version', () => {
  assert.ok(packageJson.engines, 'engines field should be defined');
  assert.ok(packageJson.engines.node, 'engines.node should be defined');
});

// Test OS constraint
test('OS constraint is set to win32', () => {
  assert.ok(packageJson.os, 'os field should be defined');
  assert.ok(Array.isArray(packageJson.os), 'os field must be an array');
  assert.ok(packageJson.os.includes('win32'), 'os field must include win32');
});

// Test repository field
test('repository field is properly configured', () => {
  assert.ok(packageJson.repository, 'repository field should be defined');
  assert.strictEqual(packageJson.repository.type, 'git', 'repository type must be git');
  assert.ok(packageJson.repository.url, 'repository url must be defined');
  assert.match(packageJson.repository.url, /^https?:\/\//, 'repository url must be a valid URL');
});

// Test that LICENSE file exists
test('LICENSE file exists', () => {
  const licensePath = join(rootDir, 'LICENSE');
  assert.ok(existsSync(licensePath), 'LICENSE file must exist');
});

// Test that README exists
test('README.md file exists', () => {
  const readmePath = join(rootDir, 'README.md');
  assert.ok(existsSync(readmePath), 'README.md file must exist');
});

// Test module type
test('package.json has type: "module"', () => {
  assert.strictEqual(packageJson.type, 'module', 'type field must be set to "module"');
});

// Summary
console.log(`\n${testsPassed}/${testsRun} tests passed`);
if (testsPassed !== testsRun) {
  process.exit(1);
}

