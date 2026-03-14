const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '../.sessions');
const SHARED_CONTEXT_PATH = path.join(SESSION_DIR, 'shared-context.jsonl');
const SHARED_CONTEXT_FILE = 'shared-context.jsonl';
const SESSION_META_RE = /^(claude|codex|opencode)-.+\.json$/;
const LAST_MESSAGE_RE = /^(claude|codex|opencode)-.+\.last-message\.txt$/;

const CAT_ROLES = {
  claude: '方案设计师',
  codex: '编码人员',
  opencode: '代码审查员'
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function getSessionFiles() {
  ensureSessionDir();

  return fs.readdirSync(SESSION_DIR)
    .map((name) => {
      const filePath = path.join(SESSION_DIR, name);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (err) {
        return null;
      }

      if (!stats.isFile()) {
        return null;
      }

      return {
        name,
        filePath,
        mtimeMs: stats.mtimeMs,
        size: stats.size
      };
    })
    .filter(Boolean);
}

function unlinkIfExists(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }

    console.error(`[session] 警告: 删除失败 ${filePath}: ${err.message}`);
    return false;
  }
}

function pruneOldest(files, maxCount) {
  if (files.length <= maxCount) {
    return 0;
  }

  const sorted = files.slice().sort((a, b) => a.mtimeMs - b.mtimeMs);
  const removeCount = sorted.length - maxCount;
  let removed = 0;

  for (let i = 0; i < removeCount; i++) {
    if (unlinkIfExists(sorted[i].filePath)) {
      removed++;
    }
  }

  return removed;
}

function pruneSessionArtifacts(options = {}) {
  const ttlDays = parsePositiveInt(options.ttlDays, parsePositiveInt(process.env.SESSION_TTL_DAYS, 30));
  const maxMetaFiles = parsePositiveInt(options.maxMetaFiles, parsePositiveInt(process.env.SESSION_MAX_META_FILES, 120));
  const maxLastMessageFiles = parsePositiveInt(options.maxLastMessageFiles, parsePositiveInt(process.env.SESSION_MAX_LAST_MESSAGE_FILES, 120));

  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  let removedCount = 0;

  const files = getSessionFiles();
  const metaFiles = files.filter(file => SESSION_META_RE.test(file.name));
  const lastMessageFiles = files.filter(file => LAST_MESSAGE_RE.test(file.name));

  const shouldExpire = (file) => (now - file.mtimeMs) > ttlMs;

  metaFiles.filter(shouldExpire).forEach((file) => {
    if (unlinkIfExists(file.filePath)) {
      removedCount++;
    }
  });

  lastMessageFiles.filter(shouldExpire).forEach((file) => {
    if (unlinkIfExists(file.filePath)) {
      removedCount++;
    }
  });

  const afterTtlFiles = getSessionFiles();
  const afterTtlMeta = afterTtlFiles.filter(file => SESSION_META_RE.test(file.name));
  const afterTtlLastMessage = afterTtlFiles.filter(file => LAST_MESSAGE_RE.test(file.name));

  removedCount += pruneOldest(afterTtlMeta, maxMetaFiles);
  removedCount += pruneOldest(afterTtlLastMessage, maxLastMessageFiles);

  return removedCount;
}

function parseSharedContext(content) {
  return content
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
}

function serializeSharedContext(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return '';
  }

  return `${records.map(record => JSON.stringify(record)).join('\n')}\n`;
}

async function compactSharedContext(options = {}) {
  const maxRecords = parsePositiveInt(options.maxRecords, parsePositiveInt(process.env.SHARED_CONTEXT_MAX_RECORDS, 300));
  const maxBytes = parsePositiveInt(options.maxBytes, parsePositiveInt(process.env.SHARED_CONTEXT_MAX_BYTES, 1024 * 1024));

  let content;

  try {
    content = await fs.promises.readFile(SHARED_CONTEXT_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return;
    }
    throw err;
  }

  const currentSize = Buffer.byteLength(content, 'utf8');
  const records = parseSharedContext(content);

  if (records.length <= maxRecords && currentSize <= maxBytes) {
    return;
  }

  let trimmed = records.slice(-maxRecords);
  let serialized = serializeSharedContext(trimmed);

  while (trimmed.length > 1 && Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    trimmed = trimmed.slice(1);
    serialized = serializeSharedContext(trimmed);
  }

  await fs.promises.writeFile(SHARED_CONTEXT_PATH, serialized, 'utf8');
}

async function readSharedContext(limit = 50) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;

  try {
    const content = await fs.promises.readFile(SHARED_CONTEXT_PATH, 'utf8');
    const records = parseSharedContext(content);

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

  const maxContentChars = parsePositiveInt(process.env.SHARED_CONTEXT_MAX_CONTENT_CHARS, 4000);
  const truncatedContent = normalizedContent.length > maxContentChars
    ? `${normalizedContent.slice(0, maxContentChars)}...(已截断)`
    : normalizedContent;

  ensureSessionDir();

  const record = {
    timestamp: new Date().toISOString(),
    role: type === 'prompt' ? '铲屎官' : cat,
    cat,
    type,
    content: truncatedContent
  };

  await fs.promises.appendFile(SHARED_CONTEXT_PATH, `${JSON.stringify(record)}\n`, 'utf8');
  await compactSharedContext();
}

function clearSessionHistory(options = {}) {
  const keepSharedContext = Boolean(options.keepSharedContext);
  ensureSessionDir();

  const files = getSessionFiles();
  const removed = [];

  files.forEach((file) => {
    if (keepSharedContext && file.name === SHARED_CONTEXT_FILE) {
      return;
    }

    if (unlinkIfExists(file.filePath)) {
      removed.push(file.name);
    }
  });

  return removed;
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
  SESSION_DIR,
  SHARED_CONTEXT_PATH,
  ensureSessionDir,
  readSharedContext,
  appendSharedContext,
  compactSharedContext,
  pruneSessionArtifacts,
  clearSessionHistory,
  formatContextForPrompt
};
