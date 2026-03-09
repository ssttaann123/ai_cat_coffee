#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 会话文件存储目录
const SESSION_DIR = path.join(__dirname, '../.sessions');

/**
 * 确保会话目录存在
 */
function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * 获取会话文件路径
 */
function getSessionPath(cli, sessionName) {
  return path.join(SESSION_DIR, `${cli}-${sessionName}.json`);
}

/**
 * 读取会话 ID
 */
function loadSession(cli, sessionName) {
  const sessionPath = getSessionPath(cli, sessionName);
  if (fs.existsSync(sessionPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      return data.sessionId;
    } catch (err) {
      return null;
    }
  }
  return null;
}

/**
 * 保存会话 ID
 */
function saveSession(cli, sessionName, sessionId) {
  ensureSessionDir();
  const sessionPath = getSessionPath(cli, sessionName);
  fs.writeFileSync(sessionPath, JSON.stringify({
    cli,
    sessionName,
    sessionId,
    lastUsed: new Date().toISOString()
  }, null, 2));
}

/**
 * 调用 Claude CLI（支持会话）
 */
function invokeClaude(prompt, sessionName = 'default') {
  return new Promise((resolve, reject) => {
    const sessionId = loadSession('claude', sessionName);
    const args = [
      '-p', prompt,
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'stream-json',
      '--verbose'
    ];

    if (sessionId) {
      console.error(`[会话] 继续: ${sessionName}`);
      args.push('--resume', sessionId);
    } else {
      console.error(`[会话] 新建: ${sessionName}`);
    }

    const claude = spawn('claude', args);

    let capturedSessionId = null;

    // 逐行解析输出
    const rl = readline.createInterface({
      input: claude.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      try {
        const data = JSON.parse(line);

        // 捕获 session_id
        if (data.session_id && !capturedSessionId) {
          capturedSessionId = data.session_id;
        }

        // 输出 assistant 消息
        if (data.type === 'assistant' && data.message?.content) {
          data.message.content.forEach(block => {
            if (block.type === 'text' && block.text) {
              process.stdout.write(block.text);
            }
          });
        }
      } catch (err) {
        // 忽略非 JSON 行
      }
    });

    claude.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    claude.on('close', (code) => {
      // 保存会话 ID
      if (capturedSessionId) {
        saveSession('claude', sessionName, capturedSessionId);
        console.error(`\n[会话] 已保存: ${capturedSessionId}`);
      }
      console.log();
      resolve(code || 0);
    });

    claude.on('error', (err) => {
      reject(new Error(`无法启动 Claude: ${err.message}`));
    });
  });
}

/**
 * 调用 OpenCode CLI
 */
function invokeOpenCode(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('opencode', ['run', prompt], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (err) => {
      reject(new Error(`无法启动 OpenCode: ${err.message}`));
    });
  });
}

/**
 * 统一调用接口
 */
function invoke(cli, prompt, sessionName = 'default') {
  if (cli === 'claude') {
    return invokeClaude(prompt, sessionName);
  } else if (cli === 'opencode') {
    return invokeOpenCode(prompt);
  } else {
    return Promise.reject(new Error(`不支持的 CLI: ${cli}`));
  }
}

// CLI 入口
if (require.main === module) {
  const cli = process.argv[2];
  const prompt = process.argv[3];
  const sessionName = process.argv[4] || 'default';

  if (!cli || !prompt) {
    console.error('用法: node invoke-session.js <claude|opencode> "你的问题" [会话名称]');
    console.error('\n示例:');
    console.error('  node invoke-session.js claude "你好" my-chat');
    console.error('  node invoke-session.js claude "继续" my-chat');
    console.error('  node invoke-session.js opencode "快速排序"');
    process.exit(1);
  }

  invoke(cli, prompt, sessionName)
    .then(code => process.exit(code))
    .catch(err => {
      console.error('错误:', err.message);
      process.exit(1);
    });
}

module.exports = { invoke, loadSession, saveSession };
