#!/usr/bin/env node
// m.js - 将当前分支合并到目标分支并推送
// 使用：m          → 交互选择目标分支
//       m sit      → 直接合并到 sit

import { execSync, spawnSync } from 'child_process';
import enquirer from 'enquirer';

const PRIORITY_BRANCHES = ['sit', 'uat', 'gray'];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function runGit(args, { inherit = true } = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe'
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function getCurrentBranch() {
  try {
    return run('git branch --show-current');
  } catch {
    return null;
  }
}

function getLocalBranches() {
  try {
    const out = run("git for-each-ref --format='%(refname:short)' refs/heads");
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getRemoteBranchNames() {
  try {
    const out = run("git for-each-ref --format='%(refname:short)' refs/remotes");
    return out
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(r => !r.endsWith('/HEAD'))
      .map(r => r.slice(r.indexOf('/') + 1));
  } catch {
    return [];
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

function isWorkingTreeClean() {
  try {
    return run('git status --porcelain') === '';
  } catch {
    return false;
  }
}

function sortBranches(branches) {
  const seen = new Set();
  const ordered = [];

  for (const name of PRIORITY_BRANCHES) {
    if (branches.includes(name) && !seen.has(name)) {
      ordered.push(name);
      seen.add(name);
    }
  }
  for (const name of branches) {
    if (!seen.has(name)) {
      ordered.push(name);
      seen.add(name);
    }
  }
  return ordered;
}

function getMergeTargetCandidates(current) {
  const local = getLocalBranches().filter(b => b !== current);
  const remoteNames = [...new Set(getRemoteBranchNames())];
  const remoteOnly = remoteNames.filter(n => n !== current && !local.includes(n));
  return sortBranches([...local, ...remoteOnly]);
}

function switchToBranch(branchName) {
  if (localBranchExists(branchName)) {
    if (runGit(['switch', branchName]).ok) return true;
    return runGit(['checkout', branchName]).ok;
  }

  const remoteRef = findRemoteRef(branchName);
  if (!remoteRef) return false;

  console.log(`🔁 本地无 ${branchName}，从 ${remoteRef} 检出 ...`);
  if (runGit(['switch', '-c', branchName, remoteRef]).ok) return true;
  return runGit(['checkout', '-b', branchName, '--track', remoteRef]).ok;
}

function fetchAndPull(branchName) {
  const remoteRef = findRemoteRef(branchName);
  const remote = remoteRef ? remoteRef.split('/')[0] : 'origin';

  console.log(`🔄 正在更新 ${branchName} ...`);
  runGit(['fetch', remote], { inherit: false });

  if (runGit(['pull', '--ff-only']).ok) return true;
  if (runGit(['pull', remote, branchName]).ok) return true;

  console.log('⚠️  拉取失败，继续尝试合并（可能基于本地分支）');
  return false;
}

function pushBranch(branchName) {
  console.log(`🚀 正在推送 ${branchName} ...`);
  const result = runGit(['push'], { inherit: false });

  if (result.ok) return true;

  if ((result.stderr || '').includes('has no upstream branch')) {
    return runGit(['push', '--set-upstream', 'origin', branchName]).ok;
  }

  console.error(result.stderr || result.stdout || '推送失败');
  return runGit(['push', 'origin', branchName]).ok;
}

function resolveBranchRef(branchName) {
  if (localBranchExists(branchName)) return branchName;
  return findRemoteRef(branchName) || branchName;
}

function getCommitsPreview(source, target) {
  try {
    const targetRef = resolveBranchRef(target);
    const out = run(`git log ${targetRef}..${source} --oneline -10`);
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function pickTargetBranch(source, candidates) {
  const localSet = new Set(getLocalBranches());
  const choices = candidates.map(name => ({
    name,
    message: localSet.has(name) ? name : `${name}（远程）`
  }));

  const select = new enquirer.Select({
    name: 'target',
    message: `选择要将「${source}」合并到的目标分支`,
    choices
  });

  try {
    return await select.run();
  } catch (e) {
    if (e === '') {
      console.log('\n已取消。');
      process.exit(0);
    }
    throw e;
  }
}

async function mergeCurrentInto(target) {
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  const source = getCurrentBranch();
  if (!source) {
    console.error('❌ 无法获取当前分支（可能处于 detached HEAD）。');
    process.exit(1);
  }

  if (source === target) {
    console.error('❌ 不能将分支合并到自身。');
    process.exit(1);
  }

  if (!localBranchExists(target) && !findRemoteRef(target)) {
    console.error(`❌ 目标分支不存在：${target}`);
    process.exit(1);
  }

  if (!isWorkingTreeClean()) {
    console.log('⚠️  工作区有未提交更改，继续操作可能失败。');
  }

  const preview = getCommitsPreview(source, target);
  if (!preview.length) {
    console.log(`ℹ️  ${target} 已包含 ${source} 的全部提交，无需合并。`);
    process.exit(0);
  }

  console.log(`\n📋 将把「${source}」合并到「${target}」，引入 ${preview.length}${preview.length >= 10 ? '+' : ''} 个提交：`);
  preview.forEach(line => console.log(`   ${line}`));
  console.log('');

  console.log(`🔁 正在切换到 ${target} ...`);
  if (!switchToBranch(target)) {
    console.error(`❌ 切换到 ${target} 失败，请检查未提交更改。`);
    process.exit(1);
  }

  fetchAndPull(target);

  console.log(`🔀 正在合并 ${source} → ${target} ...`);
  const mergeResult = runGit(['merge', source], { inherit: false });
  if (!mergeResult.ok) {
    console.error('\n❌ 合并冲突或失败，已停留在目标分支，请手动解决后：');
    console.error('   git add <file>');
    console.error('   git commit');
    console.error(`   git push origin ${target}`);
    console.error('   或 git merge --abort 放弃合并');
    process.exit(1);
  }

  if (!pushBranch(target)) {
    console.error(`❌ 合并成功但推送 ${target} 失败。`);
    process.exit(1);
  }

  console.log(`🔙 正在切回 ${source} ...`);
  if (!switchToBranch(source)) {
    console.log(`⚠️  已合入并推送 ${target}，但切回 ${source} 失败，请手动切换。`);
    process.exit(1);
  }

  console.log(`\n🎉 已将「${source}」合并到「${target}」并推送完成。`);
}

async function main() {
  const source = getCurrentBranch();
  if (!source) {
    console.error('❌ 无法获取当前分支。');
    process.exit(1);
  }

  const argTarget = process.argv.slice(2)[0];
  if (argTarget) {
    await mergeCurrentInto(argTarget);
    return;
  }

  const candidates = getMergeTargetCandidates(source);
  if (!candidates.length) {
    console.error('❌ 没有可选择的目标分支。');
    process.exit(1);
  }

  const target = await pickTargetBranch(source, candidates);
  await mergeCurrentInto(target);
}

main().catch(e => {
  console.error('致命错误：', e && e.message ? e.message : e);
  process.exit(1);
});
