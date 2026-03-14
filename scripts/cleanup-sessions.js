#!/usr/bin/env node

const { clearSessionHistory } = require('./shared-context');

const args = process.argv.slice(2);
const keepSharedContext = args.includes('--keep-shared-context');

const removed = clearSessionHistory({ keepSharedContext });

if (removed.length === 0) {
  console.log('[cleanup] 没有可删除的历史 session 文件。');
  process.exit(0);
}

console.log(`[cleanup] 已删除 ${removed.length} 个文件:`);
removed.forEach((name) => {
  console.log(`- ${name}`);
});
