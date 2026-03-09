#!/usr/bin/env node

const { spawn } = require('child_process');

const prompt = process.argv[2];

if (!prompt) {
  console.error('用法: node minimal-opencode.js "你的问题"');
  process.exit(1);
}

const child = spawn('opencode', [
  'run',
  prompt
], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('无法启动 opencode:', err.message);
  process.exit(1);
});
