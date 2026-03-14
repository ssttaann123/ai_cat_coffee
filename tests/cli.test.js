const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.sessions');

describe('CLI Scripts Tests', function() {
  describe('minimal-codex.js - parseArgs', function() {
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

    it('should parse single prompt', function() {
      const result = parseArgs(['Hello World']);
      assert.strictEqual(result.prompt, 'Hello World');
      assert.strictEqual(result.sessionName, 'default');
      assert.strictEqual(result.isResume, false);
    });

    it('should parse --session flag', function() {
      const result = parseArgs(['--session', 'my-task', 'Hello']);
      assert.strictEqual(result.prompt, 'Hello');
      assert.strictEqual(result.sessionName, 'my-task');
      assert.strictEqual(result.isResume, false);
    });

    it('should parse --resume flag', function() {
      const result = parseArgs(['--resume', 'my-task', 'Continue']);
      assert.strictEqual(result.prompt, 'Continue');
      assert.strictEqual(result.sessionName, 'my-task');
      assert.strictEqual(result.isResume, true);
    });

    it('should prioritize --resume over --session', function() {
      const result = parseArgs(['--session', 'session1', '--resume', 'session2', 'Test']);
      assert.strictEqual(result.prompt, 'Test');
      assert.strictEqual(result.sessionName, 'session2');
      assert.strictEqual(result.isResume, true);
    });

    it('should handle --help flag', function() {
      const result = parseArgs(['--help']);
      assert.strictEqual(result.help, true);
    });

    it('should handle -h flag', function() {
      const result = parseArgs(['-h']);
      assert.strictEqual(result.help, true);
    });

    it('should handle empty args', function() {
      const result = parseArgs([]);
      assert.strictEqual(result.prompt, '');
      assert.strictEqual(result.sessionName, 'default');
      assert.strictEqual(result.isResume, false);
    });

    it('should handle multi-word prompt', function() {
      const result = parseArgs(['Hello World Test']);
      assert.strictEqual(result.prompt, 'Hello World Test');
    });
  });

  describe('invoke-session.js - Session Management', function() {
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

    it('should load non-existent session as null', function() {
      const result = loadSession('codex', 'non-existent-session');
      assert.strictEqual(result, null);
    });

    it('should return correct session path', function() {
      const result = getSessionPath('codex', 'my-task');
      assert.strictEqual(result, path.join(SESSION_DIR, 'codex-my-task.json'));
    });

    it('should return correct opencode session path', function() {
      const result = getSessionPath('opencode', 'default');
      assert.strictEqual(result, path.join(SESSION_DIR, 'opencode-default.json'));
    });
  });

  describe('Code Style Tests', function() {
    it('minimal-codex.js should have correct file structure', function() {
      const content = fs.readFileSync(path.join(__dirname, 'scripts/minimal-codex.js'), 'utf8');
      const lines = content.split('\n');
      
      assert.strictEqual(lines[0], '#!/usr/bin/env node', 'First line should be shebang');
      assert.strictEqual(lines[1], '', 'Second line should be empty');
      assert.ok(lines[2].startsWith('const'), 'Third line should start with code');
    });

    it('invoke.js should not have empty first line', function() {
      const content = fs.readFileSync(path.join(__dirname, 'scripts/invoke.js'), 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      assert.notStrictEqual(lines[0], '', 'First non-empty line should not be empty');
    });
  });

  describe('File Existence Tests', function() {
    const requiredFiles = [
      'scripts/invoke-session.js',
      'scripts/minimal-codex.js',
      'scripts/minimal-claude.js',
      'scripts/minimal-opencode.js',
      'scripts/invoke.js',
      'skills/README.md',
      'skills/workflow.md',
      'skills/git-rules.md',
      'skills/coding-conventions.md'
    ];

    requiredFiles.forEach(function(file) {
      it(`${file} should exist`, function() {
        assert.ok(fs.existsSync(path.join(__dirname, file)), `${file} should exist`);
      });
    });
  });
});
