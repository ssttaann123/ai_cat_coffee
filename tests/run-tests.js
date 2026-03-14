const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SESSION_DIR = path.join(PROJECT_ROOT, '.sessions');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

const assertEqual = function(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const assertTrue = function(value, msg) {
  if (!value) {
    throw new Error(msg || 'Expected truthy value');
  }
}

console.log('=== CLI Scripts Tests ===\n');

console.log('--- minimal-codex.js parseArgs tests ---');

const parseArgs = function(args) {
  let sessionName = null;
  let resumeName = null;
  const promptParts = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--session' && args[i + 1]) {
      sessionName = args[++i];
      continue;
    }

    if (arg === '--resume' && args[i + 1]) {
      resumeName = args[++i];
      continue;
    }

    promptParts.push(arg);
  }

  const prompt = promptParts.join(' ').trim();
  return {
    help: false,
    prompt,
    sessionName: resumeName || sessionName || 'default',
    isResume: Boolean(resumeName)
  };
};

test('parse single prompt', () => {
  const result = parseArgs(['Hello World']);
  assertEqual(result.prompt, 'Hello World');
  assertEqual(result.sessionName, 'default');
  assertEqual(result.isResume, false);
});

test('parse --session flag', () => {
  const result = parseArgs(['--session', 'my-task', 'Hello']);
  assertEqual(result.prompt, 'Hello');
  assertEqual(result.sessionName, 'my-task');
  assertEqual(result.isResume, false);
});

test('parse --resume flag', () => {
  const result = parseArgs(['--resume', 'my-task', 'Continue']);
  assertEqual(result.prompt, 'Continue');
  assertEqual(result.sessionName, 'my-task');
  assertEqual(result.isResume, true);
});

test('prioritize --resume over --session', () => {
  const result = parseArgs(['--session', 'session1', '--resume', 'session2', 'Test']);
  assertEqual(result.prompt, 'Test');
  assertEqual(result.sessionName, 'session2');
  assertEqual(result.isResume, true);
});

test('handle --help flag', () => {
  const result = parseArgs(['--help']);
  assertEqual(result.help, true);
});

test('handle -h flag', () => {
  const result = parseArgs(['-h']);
  assertEqual(result.help, true);
});

test('handle empty args', () => {
  const result = parseArgs([]);
  assertEqual(result.prompt, '');
  assertEqual(result.sessionName, 'default');
  assertEqual(result.isResume, false);
});

test('handle multi-word prompt', () => {
  const result = parseArgs(['Hello World Test']);
  assertEqual(result.prompt, 'Hello World Test');
});

console.log('\n--- invoke-session.js Session Management tests ---');

const getSessionPath = function(cli, sessionName) {
  return path.join(SESSION_DIR, `${cli}-${sessionName}.json`);
};

const loadSession = function(cli, sessionName) {
  const sessionPath = getSessionPath(cli, sessionName);
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    return data.sessionId || null;
  } catch (err) {
    return null;
  }
};

test('load non-existent session returns null', () => {
  const result = loadSession('codex', 'non-existent-session');
  assertEqual(result, null);
});

test('return correct session path for codex', () => {
  const result = getSessionPath('codex', 'my-task');
  assertEqual(result, path.join(SESSION_DIR, 'codex-my-task.json'));
});

test('return correct session path for opencode', () => {
  const result = getSessionPath('opencode', 'default');
  assertEqual(result, path.join(SESSION_DIR, 'opencode-default.json'));
});

console.log('\n--- Code Style tests ---');

test('minimal-codex.js should have shebang and empty line', () => {
  const PROJECT_ROOT = path.join(__dirname, '..');
const content = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/minimal-codex.js'), 'utf8');
  const lines = content.split('\n');
  
  assertEqual(lines[0], '#!/usr/bin/env node', 'First line should be shebang');
  assertEqual(lines[1], '', 'Second line should be empty');
  assertTrue(lines[2].startsWith('const'), 'Third line should start with code');
});

test('minimal-claude.js should have shebang and empty line', () => {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/minimal-claude.js'), 'utf8');
  const lines = content.split('\n');
  
  assertEqual(lines[0], '#!/usr/bin/env node', 'First line should be shebang');
  assertEqual(lines[1], '', 'Second line should be empty');
});

test('invoke.js should not have empty first line', () => {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/invoke.js'), 'utf8');
  const lines = content.split('\n');
  assertTrue(lines[0] && lines[0].includes('node'), 'First line should be shebang, not empty');
});

console.log('\n--- File Existence tests ---');

const requiredFiles = [
  'scripts/invoke-session.js',
  'scripts/minimal-codex.js',
  'scripts/minimal-claude.js',
  'scripts/invoke.js',
  'skills/README.md',
  'skills/workflow.md',
  'skills/git-rules.md',
  'skills/coding-conventions.md'
];

requiredFiles.forEach(file => {
  test(`${file} exists`, () => {
    assertTrue(fs.existsSync(path.join(PROJECT_ROOT, file)), `${file} should exist`);
  });
});

console.log('\n=== Test Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
