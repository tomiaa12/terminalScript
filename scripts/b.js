#!/usr/bin/env node
// b.js - 执行 git branch

import { spawnSync } from 'child_process';

// 检查是否在 git 仓库
function isGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  return result.status === 0;
}

function main() {
  if (!isGitRepo()) {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  console.log('📋 Git 分支列表:\n');
  const result = spawnSync('git', ['branch'], { stdio: 'inherit' });
  process.exit(result.status || 0);
}

main();
