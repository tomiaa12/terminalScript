#!/usr/bin/env node
// res.js - Git Reset 工具：交互式管理提交回退、暂存区等操作

import { execSync, spawnSync } from 'child_process';
import Enquirer from 'enquirer';
const { Select, MultiSelect, Input, Confirm } = Enquirer;

// 执行命令并返回输出
function run(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options }).trim();
  } catch (e) {
    if (options.ignoreError) return '';
    throw e;
  }
}

// 检查是否在 git 仓库
function isGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  return result.status === 0;
}

// 获取当前分支
function getCurrentBranch() {
  try {
    return run('git branch --show-current');
  } catch {
    return null;
  }
}

// 获取已暂存的文件
function getStagedFiles() {
  try {
    const output = run('git diff --cached --name-status');
    if (!output) return [];
    
    return output.split('\n').map(line => {
      const [status, file] = line.split('\t');
      let statusText = '';
      switch (status) {
        case 'M': statusText = 'modified'; break;
        case 'A': statusText = 'new file'; break;
        case 'D': statusText = 'deleted'; break;
        case 'R': statusText = 'renamed'; break;
        default: statusText = 'changed';
      }
      return { file, status, statusText };
    });
  } catch {
    return [];
  }
}

// 获取提交列表
function getCommits(count = 10) {
  try {
    const output = run(`git log -${count} --pretty=format:"%H|%h|%s|%ar|%an"`);
    if (!output) return [];
    
    return output.split('\n').map(line => {
      const [fullHash, shortHash, message, time, author] = line.split('|');
      return { fullHash, shortHash, message, time, author };
    });
  } catch {
    return [];
  }
}

// 检查工作区是否干净
function isWorkingTreeClean() {
  try {
    const status = run('git status --porcelain');
    return status === '';
  } catch {
    return false;
  }
}

// 获取远程分支信息
function getRemoteBranch() {
  try {
    const branch = getCurrentBranch();
    if (!branch) return null;
    
    const remote = run(`git config branch.${branch}.remote`, { ignoreError: true }) || 'origin';
    const remoteBranch = run(`git config branch.${branch}.merge`, { ignoreError: true }).replace('refs/heads/', '') || branch;
    
    return {
      local: branch,
      remote: remote,
      remoteBranch: remoteBranch,
      fullRemote: `${remote}/${remoteBranch}`
    };
  } catch {
    return null;
  }
}

// 获取本地和远程的差异
function getRemoteDiff() {
  try {
    const info = getRemoteBranch();
    if (!info) return null;
    
    // 先 fetch
    console.log('🔄 正在获取远程信息...\n');
    spawnSync('git', ['fetch', info.remote], { stdio: 'pipe' });
    
    const ahead = run(`git rev-list --count ${info.fullRemote}..HEAD`, { ignoreError: true });
    const behind = run(`git rev-list --count HEAD..${info.fullRemote}`, { ignoreError: true });
    
    const aheadCommits = ahead ? getCommitsInRange(`${info.fullRemote}..HEAD`) : [];
    const behindCommits = behind ? getCommitsInRange(`HEAD..${info.fullRemote}`) : [];
    
    return {
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      aheadCommits,
      behindCommits
    };
  } catch {
    return null;
  }
}

// 获取范围内的提交
function getCommitsInRange(range) {
  try {
    const output = run(`git log ${range} --pretty=format:"%h %s"`);
    if (!output) return [];
    return output.split('\n');
  } catch {
    return [];
  }
}

// ============= 主要功能函数 =============

// 功能1：回退提交
async function resetCommits() {
  console.log('\n📜 回退提交\n');
  
  // 选择回退次数
  const countPrompt = new Select({
    name: 'count',
    message: '请选择要回退多少次提交：',
    choices: [
      { name: '1', message: '回退 1 次提交' },
      { name: '2', message: '回退 2 次提交' },
      { name: '3', message: '回退 3 次提交' },
      { name: '5', message: '回退 5 次提交' },
      { name: 'custom', message: '自定义次数' }
    ]
  });
  
  let count = await countPrompt.run();
  
  if (count === 'custom') {
    const inputPrompt = new Input({
      name: 'number',
      message: '请输入要回退的提交次数：',
      validate: (value) => {
        const num = parseInt(value);
        return num > 0 && num < 100 ? true : '请输入 1-99 之间的数字';
      }
    });
    count = await inputPrompt.run();
  }
  
  const numCount = parseInt(count);
  
  // 显示将要回退的提交
  console.log(`\n📋 将要回退以下 ${numCount} 次提交：\n`);
  const commits = getCommits(numCount);
  commits.forEach((commit, index) => {
    console.log(`  ${index + 1}. ${commit.shortHash} - ${commit.message} (${commit.time})`);
  });
  
  // 选择回退模式
  console.log('\n');
  const modePrompt = new Select({
    name: 'mode',
    message: '请选择回退模式：',
    choices: [
      { 
        name: 'soft', 
        message: '💚 soft   - 保留修改在暂存区（可以重新提交）\n          适用场景：想重新编写提交信息' 
      },
      { 
        name: 'mixed', 
        message: '🟡 mixed  - 保留修改但取消暂存（默认模式）\n          适用场景：想重新整理要提交的内容' 
      },
      { 
        name: 'hard', 
        message: '🔴 hard   - 完全丢弃所有修改 ⚠️  危险操作！\n          适用场景：确定要放弃这些提交和修改' 
      }
    ],
    initial: 1
  });
  
  const mode = await modePrompt.run();
  
  // 如果是 hard 模式，二次确认
  if (mode === 'hard') {
    console.log('\n⚠️  警告：此操作将永久删除以下内容：');
    console.log(`   - 最近 ${numCount} 次提交的所有修改`);
    console.log('   - 工作区中未提交的更改\n');
    console.log('❌ 此操作不可恢复！\n');
    
    const confirmPrompt = new Input({
      name: 'confirm',
      message: '请输入 "yes" 确认执行 hard reset：',
      validate: (value) => value === 'yes' ? true : '请输入 "yes" 确认'
    });
    
    await confirmPrompt.run();
  }
  
  // 执行 reset
  const targetCommit = `HEAD~${numCount}`;
  const result = spawnSync('git', ['reset', `--${mode}`, targetCommit], {
    stdio: 'inherit'
  });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功回退 ${numCount} 次提交（模式：${mode}）\n`);
    
    // 显示当前 HEAD
    const currentHead = run('git log -1 --pretty=format:"%h - %s"');
    console.log(`当前状态：`);
    console.log(`  HEAD 现在位于: ${currentHead}\n`);
    console.log(`💡 提示：运行 'git reflog' 可以查看完整的操作历史\n`);
  } else {
    console.error('\n❌ 回退失败\n');
    process.exit(1);
  }
}

// 功能2：取消暂存文件
async function unstageFiles() {
  console.log('\n📦 取消暂存文件\n');
  
  const staged = getStagedFiles();
  
  if (staged.length === 0) {
    console.log('ℹ️  当前没有已暂存的文件\n');
    return;
  }
  
  console.log('当前已暂存的文件：\n');
  
  const choices = [
    { name: '__all__', message: '🔘 全选（取消暂存所有文件）' },
    ...staged.map(item => ({
      name: item.file,
      message: `${item.file} (${item.statusText})`
    }))
  ];
  
  const selectPrompt = new MultiSelect({
    name: 'files',
    message: '请选择要取消暂存的文件（空格选择，回车确认）：',
    choices
  });
  
  let selected = await selectPrompt.run();
  
  // 处理全选
  if (selected.includes('__all__')) {
    selected = staged.map(item => item.file);
  } else {
    selected = selected.filter(s => s !== '__all__');
  }
  
  if (selected.length === 0) {
    console.log('\n未选择任何文件\n');
    return;
  }
  
  // 执行 unstage
  console.log('');
  for (const file of selected) {
    const result = spawnSync('git', ['reset', 'HEAD', file], { stdio: 'pipe' });
    if (result.status === 0) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} (失败)`);
    }
  }
  
  console.log(`\n✅ 已取消暂存 ${selected.length} 个文件\n`);
  console.log('💡 文件修改仍在工作区中保留\n');
}

// 功能3：重置到远程分支
async function resetToRemote() {
  console.log('\n🔗 重置到远程分支\n');
  
  const info = getRemoteBranch();
  if (!info) {
    console.error('❌ 无法获取远程分支信息\n');
    return;
  }
  
  console.log(`当前分支：${info.local}`);
  console.log(`远程分支：${info.fullRemote}\n`);
  
  const diff = getRemoteDiff();
  
  if (!diff) {
    console.error('❌ 无法获取远程差异信息\n');
    return;
  }
  
  if (diff.ahead === 0 && diff.behind === 0) {
    console.log('✅ 本地分支已经与远程分支同步\n');
    return;
  }
  
  // 显示差异
  console.log('📊 本地与远程的差异：\n');
  
  if (diff.ahead > 0) {
    console.log(`本地领先 ${diff.ahead} 个提交：`);
    diff.aheadCommits.forEach(commit => console.log(`  - ${commit}`));
    console.log('');
  }
  
  if (diff.behind > 0) {
    console.log(`远程领先 ${diff.behind} 个提交：`);
    diff.behindCommits.forEach(commit => console.log(`  - ${commit}`));
    console.log('');
  }
  
  console.log('⚠️  此操作会将本地分支重置到远程分支的最新状态\n');
  
  // 选择重置模式
  const modePrompt = new Select({
    name: 'mode',
    message: '请选择重置模式：',
    choices: [
      { name: 'mixed', message: 'mixed - 保留本地修改但取消暂存（推荐）' },
      { name: 'soft', message: 'soft  - 保留本地修改在暂存区' },
      { name: 'hard', message: 'hard  - 完全丢弃本地修改 ⚠️' }
    ]
  });
  
  const mode = await modePrompt.run();
  
  // 确认
  const confirmPrompt = new Confirm({
    name: 'confirm',
    message: `确认要将本地分支重置到 ${info.fullRemote} 吗？`,
    initial: false
  });
  
  const confirmed = await confirmPrompt.run();
  
  if (!confirmed) {
    console.log('\n已取消操作\n');
    return;
  }
  
  // 执行重置
  console.log('\n执行中...\n');
  const result = spawnSync('git', ['reset', `--${mode}`, info.fullRemote], {
    stdio: 'inherit'
  });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功重置到 ${info.fullRemote}\n`);
  } else {
    console.error('\n❌ 重置失败\n');
    process.exit(1);
  }
}

// 功能4：重置到指定提交
async function resetToCommit() {
  console.log('\n🎯 重置到指定提交\n');
  
  console.log('最近的 10 次提交：\n');
  const commits = getCommits(10);
  commits.forEach((commit, index) => {
    console.log(`  ${(index + 1).toString().padStart(2, ' ')}. ${commit.shortHash} - ${commit.message} (${commit.time})`);
  });
  
  console.log('');
  
  // 选择输入方式
  const methodPrompt = new Select({
    name: 'method',
    message: '请选择：',
    choices: [
      { name: 'list', message: '从列表中选择提交' },
      { name: 'manual', message: '手动输入 commit hash' }
    ]
  });
  
  const method = await methodPrompt.run();
  
  let targetCommit = null;
  let commitInfo = null;
  
  if (method === 'list') {
    const choices = commits.map(commit => ({
      name: commit.shortHash,
      message: `${commit.shortHash} - ${commit.message} (${commit.time})`
    }));
    
    const selectPrompt = new Select({
      name: 'commit',
      message: '请选择要重置到的提交：',
      choices
    });
    
    targetCommit = await selectPrompt.run();
    commitInfo = commits.find(c => c.shortHash === targetCommit);
  } else {
    const inputPrompt = new Input({
      name: 'hash',
      message: '请输入 commit hash (完整或前 7 位)：',
      validate: (value) => value.length >= 6 ? true : '请输入至少 6 个字符'
    });
    
    targetCommit = await inputPrompt.run();
    
    // 验证并获取提交信息
    try {
      const info = run(`git log -1 ${targetCommit} --pretty=format:"%H|%h|%s|%ar|%an"`);
      const [fullHash, shortHash, message, time, author] = info.split('|');
      commitInfo = { fullHash, shortHash, message, time, author };
    } catch {
      console.error('\n❌ 无效的 commit hash\n');
      return;
    }
  }
  
  // 显示目标提交信息
  console.log('\n目标提交信息：');
  console.log(`  Hash: ${commitInfo.shortHash}`);
  console.log(`  作者: ${commitInfo.author}`);
  console.log(`  时间: ${commitInfo.time}`);
  console.log(`  信息: ${commitInfo.message}\n`);
  
  // 选择重置模式
  const modePrompt = new Select({
    name: 'mode',
    message: '请选择重置模式：',
    choices: [
      { name: 'mixed', message: 'mixed - 保留修改但取消暂存（推荐）' },
      { name: 'soft', message: 'soft  - 保留修改在暂存区' },
      { name: 'hard', message: 'hard  - 完全丢弃所有修改 ⚠️' }
    ]
  });
  
  const mode = await modePrompt.run();
  
  // 确认
  console.log(`\n⚠️  将重置到提交: ${commitInfo.shortHash}`);
  const confirmPrompt = new Confirm({
    name: 'confirm',
    message: '确认执行吗？',
    initial: false
  });
  
  const confirmed = await confirmPrompt.run();
  
  if (!confirmed) {
    console.log('\n已取消操作\n');
    return;
  }
  
  // 执行重置
  console.log('\n执行中...\n');
  const result = spawnSync('git', ['reset', `--${mode}`, commitInfo.shortHash], {
    stdio: 'inherit'
  });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功重置到指定提交\n`);
  } else {
    console.error('\n❌ 重置失败\n');
    process.exit(1);
  }
}

// ============= 主函数 =============

async function main() {
  // 检查 git 仓库
  if (!isGitRepo()) {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }
  
  console.log('\n🔄 Git Reset 工具\n');
  
  // 主菜单
  const mainPrompt = new Select({
    name: 'action',
    message: '请选择要执行的操作：',
    choices: [
      { 
        name: 'resetCommits', 
        message: '📜 回退提交 - 撤销最近的提交（保留或丢弃修改）' 
      },
      { 
        name: 'unstageFiles', 
        message: '📦 取消暂存文件 - 将已暂存的文件移出暂存区' 
      },
      { 
        name: 'resetToRemote', 
        message: '🔗 重置到远程分支 - 将本地分支重置到远程最新状态' 
      },
      { 
        name: 'resetToCommit', 
        message: '🎯 重置到指定提交 - 输入 commit hash 进行精确重置' 
      },
      { 
        name: 'cancel', 
        message: '❌ 取消' 
      }
    ]
  });
  
  try {
    const action = await mainPrompt.run();
    
    switch (action) {
      case 'resetCommits':
        await resetCommits();
        break;
      case 'unstageFiles':
        await unstageFiles();
        break;
      case 'resetToRemote':
        await resetToRemote();
        break;
      case 'resetToCommit':
        await resetToCommit();
        break;
      case 'cancel':
        console.log('\n已取消\n');
        break;
    }
  } catch (err) {
    if (err === '') {
      console.log('\n\n已取消操作\n');
      process.exit(0);
    }
    console.error('\n操作出错：', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
