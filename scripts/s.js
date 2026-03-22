#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import Enquirer from 'enquirer';
const { Select } = Enquirer;

const cwd = process.cwd();
const pkgPath = path.join(cwd, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.error('❌ 当前目录没有 package.json');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const scripts = pkg.scripts || {};

if (Object.keys(scripts).length === 0) {
  console.log('⚠️ 没有找到任何 npm scripts');
  process.exit(0);
}

// 获取当前 git 分支名
let currentBranch = '';
try {
  currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
} catch {
  currentBranch = '';
}

// 找出默认选中项
let defaultScript = Object.keys(scripts).find(s => s.includes("sit"));
if (!defaultScript) {
  defaultScript = Object.keys(scripts).find(s => s.includes(currentBranch)) || Object.keys(scripts)[0];
}

// 选择要运行的命令
const prompt = new Select({
  name: 'script',
  message: '请选择要运行的 npm 命令:',
  choices: Object.keys(scripts),
  initial: Object.keys(scripts).indexOf(defaultScript)
});

const run = async () => {
  const script = await prompt.run();
  console.log(`🚀 正在运行：npm run ${script}\n`);
  const child = spawn('npm', ['run', script], { stdio: 'inherit', shell: true });
  child.on('exit', code => process.exit(code ?? 0));
};

run();
