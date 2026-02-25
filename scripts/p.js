#!/usr/bin/env node
// p.js - 执行 git pull

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

  console.log('🔄 正在执行 git pull...\n');
  const result = spawnSync('git', ['pull'], { stdio: 'inherit' });
  process.exit(result.status || 0);
}

main();
