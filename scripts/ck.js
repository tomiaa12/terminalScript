#!/usr/bin/env node
// ck.js
// 功能：
//  1️⃣ 无参数 → 交互选择分支并切换
//  2️⃣ 带参数 → 智能切换/创建分支：
//     - 本地已存在 → 直接切换
//     - 本地不存在、远程存在 → 检出并跟踪远程分支
//     - 都不存在 → 从当前分支创建（git checkout -b <name>）

import { execSync, spawnSync } from 'child_process';
import enquirer from 'enquirer';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

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
    return run('git branch --show-current');
  } catch {
    return null;
  }
}

function localBranchExists(name) {
  try {
    run(`git rev-parse --verify refs/heads/${name}`);
    return true;
  } catch {
    return false;
  }
}

// 查找与分支名匹配的远程 ref（如 origin/feature/foo），优先 origin
function findRemoteRef(branchName) {
  try {
    const out = run("git for-each-ref --format='%(refname:short)' refs/remotes");
    const refs = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const matches = refs.filter(r => {
      if (r.endsWith('/HEAD')) return false;
      const idx = r.indexOf('/');
      return idx !== -1 && r.slice(idx + 1) === branchName;
    });
    if (!matches.length) return null;
    return matches.find(r => r.startsWith('origin/')) || matches[0];
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

// 从远程 ref 检出并跟踪
function checkoutFromRemote(branchName, remoteRef) {
  if (runGitCommand(['switch', '-c', branchName, remoteRef])) return true;
  return runGitCommand(['checkout', '-b', branchName, '--track', remoteRef]);
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

async function resolveAndSwitch(targetBranch) {
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  const current = getCurrentBranch();
  if (current === targetBranch) {
    console.log(`✅ 已在分支：${targetBranch}`);
    return;
  }

  if (localBranchExists(targetBranch)) {
    console.log(`🔁 本地分支已存在，正在切换到：${targetBranch} ...`);
    if (switchBranch(targetBranch)) {
      console.log(`🎉 已切换到分支：${targetBranch}`);
    } else {
      console.error('❌ 切换失败，请检查是否有未提交的更改。');
    }
    return;
  }

  const remoteRef = findRemoteRef(targetBranch);
  if (remoteRef) {
    console.log(`🔁 发现远程分支 ${remoteRef}，正在检出并跟踪 ...`);
    if (checkoutFromRemote(targetBranch, remoteRef)) {
      console.log(`🎉 已从 ${remoteRef} 检出并切换到：${targetBranch}`);
    } else {
      console.error('❌ 从远程分支检出失败。');
    }
    return;
  }

  const currentBranch = getCurrentBranch();
  if (currentBranch) {
    console.log(`🚀 本地与远程均无此分支，正在从「${currentBranch}」创建并切换到：${targetBranch} ...`);
  } else {
    console.log(`🚀 本地与远程均无此分支，正在创建并切换到：${targetBranch} ...`);
  }
  const ok = runGitCommand(['checkout', '-b', targetBranch]);
  if (ok) {
    if (currentBranch) {
      console.log(`🎉 已从分支「${currentBranch}」创建并切换到新分支：${targetBranch}`);
    } else {
      console.log(`🎉 新分支已创建并切换到：${targetBranch}`);
    }
  } else {
    console.error('❌ 创建分支失败，可能有未提交更改。');
  }
}

// ---------------- 主逻辑 ----------------
const args = process.argv.slice(2);

if (args.length > 0) {
  // 传入参数：智能切换/创建分支
  const newBranch = args[0];
  await resolveAndSwitch(newBranch);
} else {
  // 无参数：交互切换
  await interactiveSwitch();
}
