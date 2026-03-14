#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  ensureSessionDir,
  readSharedContext,
  appendSharedContext,
  formatContextForPrompt
} = require('./shared-context');

// 会话文件存储目录
const SESSION_DIR = path.join(__dirname, '../.sessions');
const DEFAULT_CONTEXT_LIMIT = 50;

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
 * 生成临时输出文件路径
 */
function getOutputPath(cli, sessionName) {
  ensureSessionDir();
  return path.join(SESSION_DIR, `${cli}-${sessionName}.last-message.txt`);
}

async function buildPromptWithContext(prompt, contextLimit = DEFAULT_CONTEXT_LIMIT) {
  const records = await readSharedContext(contextLimit);
  const contextText = formatContextForPrompt(records);

  if (!contextText) {
    return prompt;
  }

  return `${contextText}\n\n${prompt}`;
}

async function logSharedInteraction(cat, prompt, response) {
  await appendSharedContext(cat, 'prompt', prompt);
  await appendSharedContext(cat, 'response', response);
}

/**
 * 调用 Claude CLI（支持会话）
 */
async function invokeClaude(prompt, sessionName = 'default', options = {}) {
  const contextLimit = options.contextLimit || DEFAULT_CONTEXT_LIMIT;
  const injectedPrompt = await buildPromptWithContext(prompt, contextLimit);

  return new Promise((resolve, reject) => {
    const sessionId = loadSession('claude', sessionName);
    const args = [
      '-p', injectedPrompt,
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
    let responseText = '';

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
          data.message.content.forEach((block) => {
            if (block.type === 'text' && block.text) {
              responseText += block.text;
              process.stdout.write(block.text);
            }
          });
        }
      } catch (err) {
        // 忽略非 JSON 行
      }
    });

    claude.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    claude.on('close', async (code) => {
      try {
        if (capturedSessionId) {
          saveSession('claude', sessionName, capturedSessionId);
          console.error(`\n[会话] 已保存: ${capturedSessionId}`);
        }

        process.stdout.write('\n');
        await logSharedInteraction('claude', prompt, responseText);
        resolve(code || 0);
      } catch (err) {
        reject(err);
      }
    });

    claude.on('error', (err) => {
      reject(new Error(`无法启动 Claude: ${err.message}`));
    });
  });
}

/**
 * 调用 OpenCode CLI（支持会话）
 */
async function invokeOpenCode(prompt, sessionName = 'default', options = {}) {
  const contextLimit = options.contextLimit || DEFAULT_CONTEXT_LIMIT;
  const injectedPrompt = await buildPromptWithContext(prompt, contextLimit);

  return new Promise((resolve, reject) => {
    const args = ['run'];

    // 如果指定了 session 名称，加载会话 ID
    if (sessionName && sessionName !== 'default') {
      const sessionId = loadSession('opencode', sessionName);
      if (sessionId) {
        args.push('--session', sessionId);
        console.error(`[会话] 继续: ${sessionName} (${sessionId})`);
      } else {
        console.error(`[会话] 新建: ${sessionName}`);
      }
    }

    if (injectedPrompt) {
      args.push(injectedPrompt);
    }

    const child = spawn('opencode', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutText = '';
    let stderrText = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutText += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderrText += text;
      process.stderr.write(text);
    });

    child.on('close', async (code) => {
      try {
        const responseText = stdoutText.trim() || stderrText.trim();
        await logSharedInteraction('opencode', prompt, responseText);

        if (code && !responseText) {
          reject(new Error('OpenCode 执行失败'));
          return;
        }

        resolve(code || 0);
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', (err) => {
      reject(new Error(`无法启动 OpenCode: ${err.message}`));
    });
  });
}

/**
 * 调用 Codex CLI（支持会话）
 */
async function invokeCodex(prompt, sessionName = 'default', options = {}) {
  const contextLimit = options.contextLimit || DEFAULT_CONTEXT_LIMIT;
  const injectedPrompt = await buildPromptWithContext(prompt, contextLimit);

  return new Promise((resolve, reject) => {
    const sessionId = loadSession('codex', sessionName);
    const outputPath = getOutputPath('codex', sessionName);
    const args = sessionId
      ? ['exec', 'resume', sessionId, injectedPrompt, '--json', '-o', outputPath]
      : ['exec', injectedPrompt, '--json', '-o', outputPath];

    const child = spawn('codex', args);
    let capturedSessionId = sessionId;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      lines.forEach((line) => {
        if (!line.trim()) {
          return;
        }

        try {
          const event = JSON.parse(line);
          if (event.type === 'thread.started' && event.thread_id) {
            capturedSessionId = event.thread_id;
          }
        } catch (err) {
          // 忽略非 JSON 行
        }
      });
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('close', async (code) => {
      try {
        if (stdoutBuffer.trim()) {
          try {
            const event = JSON.parse(stdoutBuffer);
            if (event.type === 'thread.started' && event.thread_id) {
              capturedSessionId = event.thread_id;
            }
          } catch (err) {
            // 忽略非 JSON 行
          }
        }

        if (capturedSessionId) {
          saveSession('codex', sessionName, capturedSessionId);
        }

        let hasMessage = false;
        let responseText = '';

        if (fs.existsSync(outputPath)) {
          const message = fs.readFileSync(outputPath, 'utf8').trimEnd();
          if (message) {
            hasMessage = true;
            responseText = message;
            process.stdout.write(message);
          }
          process.stdout.write('\n');
        }

        if (!responseText && stderrBuffer.trim()) {
          responseText = stderrBuffer.trim();
        }

        await logSharedInteraction('codex', prompt, responseText);

        if (code && !hasMessage) {
          const errorMessage = stderrBuffer.trim() || 'Codex 执行失败';
          reject(new Error(errorMessage));
          return;
        }

        resolve(code || 0);
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', (err) => {
      reject(new Error(`无法启动 Codex: ${err.message}`));
    });
  });
}

/**
 * 统一调用接口
 */
function invoke(cli, prompt, sessionName = 'default', options = {}) {
  if (cli === 'claude') {
    return invokeClaude(prompt, sessionName, options);
  }

  if (cli === 'opencode') {
    return invokeOpenCode(prompt, sessionName, options);
  }

  if (cli === 'codex') {
    return invokeCodex(prompt, sessionName, options);
  }

  return Promise.reject(new Error(`不支持的 CLI: ${cli}`));
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);

  // 兼容 invoke.js 的简单调用: node invoke-session.js <cli> "你的问题"
  if (args.length === 2 && !args[0].startsWith('-') && !args[1].startsWith('-')) {
    const cli = args[0];
    const prompt = args[1];

    if (cli !== 'claude' && cli !== 'opencode' && cli !== 'codex') {
      console.error('错误: 不支持的 CLI');
      process.exit(1);
    }

    invoke(cli, prompt)
      .then(code => process.exit(code))
      .catch((err) => {
        console.error('错误:', err.message);
        process.exit(1);
      });
    return;
  }

  const cli = args[0];

  // 解析 --session / --resume / --context-limit 和 prompt
  let sessionName = null;
  let explicitSessionMode = null;
  let resume = false;
  let prompt = null;
  let contextLimit = DEFAULT_CONTEXT_LIMIT;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) {
      sessionName = args[++i];
      explicitSessionMode = 'session';
    } else if (args[i] === '--resume' && args[i + 1]) {
      sessionName = args[++i];
      resume = true;
      explicitSessionMode = 'resume';
    } else if (args[i] === '--context-limit' && args[i + 1]) {
      const parsed = Number.parseInt(args[++i], 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        console.error('错误: --context-limit 需要大于 0 的整数');
        process.exit(1);
      }
      contextLimit = parsed;
    } else if (!prompt) {
      prompt = args[i];
    } else if (!sessionName && !args[i].startsWith('-')) {
      // 兼容位置参数: node invoke-session.js <cli> "问题" <会话名>
      sessionName = args[i];
    }
  }

  if (!cli || !prompt) {
    console.error('用法:');
    console.error('  简单调用:    node invoke-session.js <cli> "你的问题"');
    console.error('  位置会话:    node invoke-session.js <cli> "你的问题" <会话名>');
    console.error('  新建会话:    node invoke-session.js <cli> --session <名称> "你的问题"');
    console.error('  恢复会话:    node invoke-session.js <cli> --resume <名称> "继续的问题"');
    console.error('  限制上下文:  node invoke-session.js <cli> --context-limit <n> "你的问题"');
    console.error('\n示例:');
    console.error('  node invoke-session.js claude "什么是attention机制"');
    console.error('  node invoke-session.js claude "继续刚才的问题" my-task');
    console.error('  node invoke-session.js opencode --session "讨论" "继续讲讲multi-head"');
    console.error('  node invoke-session.js claude --resume "讨论transformer" "继续讲讲multi-head"');
    console.error('  node invoke-session.js codex --context-limit 20 "继续实现接口"');
    process.exit(1);
  }

  // --resume 时必须有已保存的会话
  if (resume) {
    if (!sessionName) {
      console.error('错误: --resume 需要指定会话名称');
      process.exit(1);
    }
    const existingId = loadSession(cli, sessionName);
    if (!existingId) {
      console.error(`错误: 找不到会话 "${sessionName}"，请先用 --session 创建`);
      process.exit(1);
    }
  }

  // 仅在显式 --session 时保持覆盖行为
  if (sessionName && explicitSessionMode === 'session' && !resume) {
    const existingId = loadSession(cli, sessionName);
    if (existingId) {
      console.error(`[会话] 警告: "${sessionName}" 已存在，将创建新会话覆盖旧的`);
      // 删除旧会话文件，强制新建
      const sessionPath = getSessionPath(cli, sessionName);
      fs.unlinkSync(sessionPath);
    }
  }

  invoke(cli, prompt, sessionName || 'default', { contextLimit })
    .then(code => process.exit(code))
    .catch((err) => {
      console.error('错误:', err.message);
      process.exit(1);
    });
}

module.exports = { invoke, loadSession, saveSession };
