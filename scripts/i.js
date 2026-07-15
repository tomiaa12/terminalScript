#!/usr/bin/env node
// i.js - 根据 lock 文件自动选择包管理器安装依赖

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function main() {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.error('❌ 当前目录没有 package.json');
    process.exit(1);
  }

  let cmd;
  let args;
  let label;

  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    cmd = 'pnpm';
    args = ['i'];
    label = 'pnpm i';
  } else if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    cmd = 'yarn';
    args = ['install'];
    label = 'yarn install';
  } else {
    cmd = 'npm';
    args = ['i'];
    label = 'npm i';
  }

  console.log(`📦 正在执行 ${label}...\n`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

main();
