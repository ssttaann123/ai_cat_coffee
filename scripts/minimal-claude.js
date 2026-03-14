#!/usr/bin/env node

const { spawn } = require('child_process');

const prompt = process.argv[2];

if (!prompt) {
  console.error('用法: node minimal-claude.js "你的问题"');
  process.exit(1);
}

// 启动 Claude CLI 进程
const claude = spawn('claude', [
  '-p', prompt,
  '--permission-mode', 'bypassPermissions'
], {
  stdio: 'inherit'
});

// 处理进程退出
claude.on('close', (code) => {
  process.exit(code || 0);
});

// 处理进程错误
claude.on('error', (err) => {
  console.error('无法启动 Claude CLI:', err.message);
  process.exit(1);
});
