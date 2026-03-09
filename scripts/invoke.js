#!/usr/bin/env node

const { spawn } = require('child_process');

/**
 * 调用 AI CLI 工具
 * @param {string} cli - CLI 名称 ('claude' 或 'opencode')
 * @param {string} prompt - 问题/提示词
 * @returns {Promise<number>} 退出码
 */
function invoke(cli, prompt) {
  return new Promise((resolve, reject) => {
    // 根据不同的 CLI 配置参数
    let args;

    if (cli === 'claude') {
      args = [
        '-p', prompt,
        '--permission-mode', 'bypassPermissions'
      ];
    } else if (cli === 'opencode') {
      args = ['run', prompt];
    } else {
      reject(new Error(`不支持的 CLI: ${cli}`));
      return;
    }

    // 启动进程
    const process = spawn(cli, args, {
      stdio: 'inherit'
    });

    // 处理进程退出
    process.on('close', (code) => {
      resolve(code || 0);
    });

    // 处理进程错误
    process.on('error', (err) => {
      reject(new Error(`无法启动 ${cli}: ${err.message}`));
    });
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  const cli = process.argv[2];
  const prompt = process.argv[3];

  if (!cli || !prompt) {
    console.error('用法: node invoke.js <claude|opencode> "你的问题"');
    process.exit(1);
  }

  invoke(cli, prompt)
    .then(code => process.exit(code))
    .catch(err => {
      console.error('错误:', err.message);
      process.exit(1);
    });
}

module.exports = { invoke };
