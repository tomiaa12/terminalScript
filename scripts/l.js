#!/usr/bin/env node
// l.js - 查看 git 提交历史

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

  // 使用美观的 git log 格式
  const args = [
    'log',
    '--oneline',
    '--decorate',
    '--graph',
    '--color',
    '-20' // 默认显示最近 20 条
  ];

  // 如果有额外参数，使用用户提供的参数
  if (process.argv.length > 2) {
    const userArgs = process.argv.slice(2);
    const result = spawnSync('git', ['log', ...userArgs], { stdio: 'inherit' });
    process.exit(result.status || 0);
  } else {
    const result = spawnSync('git', args, { stdio: 'inherit' });
    process.exit(result.status || 0);
  }
}

main();
