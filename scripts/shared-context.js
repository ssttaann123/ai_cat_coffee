const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '../.sessions');
const SHARED_CONTEXT_PATH = path.join(SESSION_DIR, 'shared-context.jsonl');

const CAT_ROLES = {
  claude: '方案设计师',
  codex: '编码人员',
  opencode: '代码审查员'
};

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

async function readSharedContext(limit = 50) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;

  try {
    const content = await fs.promises.readFile(SHARED_CONTEXT_PATH, 'utf8');
    const records = content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          console.error(`[共享上下文] 警告: 跳过损坏记录: ${line}`);
          return null;
        }
      })
      .filter(Boolean);

    if (records.length <= normalizedLimit) {
      return records;
    }

    return records.slice(-normalizedLimit);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function appendSharedContext(cat, type, content) {
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!normalizedContent) {
    return;
  }

  ensureSessionDir();

  const record = {
    timestamp: new Date().toISOString(),
    role: type === 'prompt' ? '铲屎官' : cat,
    cat,
    type,
    content: normalizedContent
  };

  await fs.promises.appendFile(SHARED_CONTEXT_PATH, `${JSON.stringify(record)}\n`, 'utf8');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatContextForPrompt(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  const lines = records.map((record) => {
    const catName = record.cat || 'unknown';
    const roleText = CAT_ROLES[catName] || '协作者';
    const catDisplay = catName.charAt(0).toUpperCase() + catName.slice(1);
    const prefix = record.type === 'prompt' ? '铲屎官问' : '回复';
    const content = typeof record.content === 'string' ? record.content : '';
    return `[${formatTime(record.timestamp)} ${catDisplay}(${roleText})] ${prefix}: ${content}`;
  });

  return [
    '[共享上下文 - 团队对话记录]',
    '---',
    ...lines,
    '---',
    '[当前对话开始]'
  ].join('\n');
}

module.exports = {
  CAT_ROLES,
  ensureSessionDir,
  readSharedContext,
  appendSharedContext,
  formatContextForPrompt
};
