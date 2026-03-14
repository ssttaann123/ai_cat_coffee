#!/usr/bin/env node

const readline = require('readline');
const { invoke, loadSession } = require('./invoke-session');

function printUsage() {
  console.error('用法:');
  console.error('  单次调用: node scripts/minimal-codex.js "你的问题"');
  console.error('  交互对话: node scripts/minimal-codex.js');
  console.error('  指定会话: node scripts/minimal-codex.js --session <名称>');
  console.error('  恢复会话: node scripts/minimal-codex.js --resume <名称>');
}

function parseArgs(args) {
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
}

async function invokeOnce(prompt, sessionName) {
  const code = await invoke('codex', prompt, sessionName);
  process.exit(code || 0);
}

async function startInteractive(sessionName) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '你> '
  });

  let running = false;

  console.error(`[Codex] 会话: ${sessionName}`);
  console.error('[Codex] 输入 exit 或 quit 结束对话。');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }

    if (running) {
      console.error('上一条消息仍在处理中，请稍候...');
      rl.prompt();
      return;
    }

    running = true;
    try {
      await invoke('codex', input, sessionName);
    } catch (err) {
      console.error(`错误: ${err.message}`);
    } finally {
      running = false;
      rl.prompt();
    }
  });

  rl.on('close', () => {
    process.stdout.write('\n');
    process.exit(0);
  });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printUsage();
    process.exit(0);
  }

  if (parsed.isResume && !loadSession('codex', parsed.sessionName)) {
    console.error(`错误: 找不到会话 "${parsed.sessionName}"，请先用 --session 创建。`);
    process.exit(1);
  }

  if (parsed.prompt) {
    await invokeOnce(parsed.prompt, parsed.sessionName);
    return;
  }

  await startInteractive(parsed.sessionName);
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
