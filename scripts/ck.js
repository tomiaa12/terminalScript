#!/usr/bin/env node
// ck.js
// 功能：
//  1️⃣ 无参数 → 交互选择分支并切换
//  2️⃣ 带参数 → 从当前分支创建并切换到新分支（git checkout -b <name>）

import { execSync, spawnSync } from 'child_process';
import enquirer from 'enquirer';

// 获取当前分支列表
function getBranches() {
  try {
    const out = execSync('git branch --no-color', { encoding: 'utf8' });
    const lines = out.split(/\r?\n/).filter(Boolean);
    return lines.map(l => {
      const isCurrent = l.trim().startsWith('*');
      const name = l.replace(/^[\*\s]+/, '');
      return { name, isCurrent };
    });
  } catch {
    return null;
  }
}

// 获取当前分支名称
function getCurrentBranch() {
  try {
    const out = execSync('git branch --show-current', { encoding: 'utf8' });
    return out.trim();
  } catch {
    return null;
  }
}

// 执行 git 命令（带输出）
function runGitCommand(args) {
  const result = spawnSync('git', args, { stdio: 'inherit' });
  return result.status === 0;
}

// 切换分支
function switchBranch(branch) {
  if (!runGitCommand(['switch', branch])) {
    return runGitCommand(['checkout', branch]);
  }
  return true;
}

async function interactiveSwitch() {
  const branches = getBranches();
  if (!branches) {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  const choices = branches.map(b => ({
    name: b.name,
    message: b.isCurrent ? `* ${b.name}（当前分支）` : b.name
  }));

  const initial = branches.findIndex(b => b.isCurrent);
  const select = new enquirer.Select({
    name: 'branch',
    message: '请选择要切换的分支（上下键选择，回车确认）',
    choices,
    initial: initial === -1 ? 0 : initial
  });

  const branch = await select.run();
  const current = branches.find(b => b.isCurrent)?.name;

  if (branch === current) {
    console.log(`✅ 已在分支：${branch}`);
    return;
  }

  console.log(`🔁 正在切换到分支：${branch} ...`);
  if (switchBranch(branch)) {
    console.log(`🎉 已切换到分支：${branch}`);
  } else {
    console.error('❌ 切换失败，请检查是否有未提交的更改。');
  }
}

async function createAndSwitch(newBranch) {
  const currentBranch = getCurrentBranch();
  if (currentBranch) {
    console.log(`🚀 正在从分支「${currentBranch}」创建并切换到新分支：${newBranch} ...`);
  } else {
    console.log(`🚀 正在创建并切换到新分支：${newBranch} ...`);
  }
  const ok = runGitCommand(['checkout', '-b', newBranch]);
  if (ok) {
    if (currentBranch) {
      console.log(`🎉 已从分支「${currentBranch}」创建并切换到新分支：${newBranch}`);
    } else {
      console.log(`🎉 新分支已创建并切换到：${newBranch}`);
    }
  } else {
    console.error('❌ 创建分支失败，可能分支已存在或有未提交更改。');
  }
}

// ---------------- 主逻辑 ----------------
const args = process.argv.slice(2);

if (args.length > 0) {
  // 传入参数：创建并切换分支
  const newBranch = args[0];
  await createAndSwitch(newBranch);
} else {
  // 无参数：交互切换
  await interactiveSwitch();
}
