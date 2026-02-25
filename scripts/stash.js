#!/usr/bin/env node
// stash.js - Git Stash 管理器：交互式管理工作区暂存

import { execSync, spawnSync } from 'child_process';
import Enquirer from 'enquirer';
const { Select, Input, Confirm } = Enquirer;

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

// 获取工作区状态
function getWorkingStatus() {
  try {
    const modifiedFiles = run('git diff --name-only', { ignoreError: true });
    const stagedFiles = run('git diff --cached --name-only', { ignoreError: true });
    const untrackedFiles = run('git ls-files --others --exclude-standard', { ignoreError: true });
    
    return {
      modified: modifiedFiles ? modifiedFiles.split('\n').filter(Boolean).length : 0,
      staged: stagedFiles ? stagedFiles.split('\n').filter(Boolean).length : 0,
      untracked: untrackedFiles ? untrackedFiles.split('\n').filter(Boolean).length : 0
    };
  } catch {
    return { modified: 0, staged: 0, untracked: 0 };
  }
}

// 获取 stash 列表
function getStashList() {
  try {
    const output = run('git stash list --pretty=format:"%gd|%s|%cr"', { ignoreError: true });
    if (!output) return [];
    
    return output.split('\n').map(line => {
      const [ref, message, time] = line.split('|');
      return { ref, message, time };
    });
  } catch {
    return [];
  }
}

// 检查是否有工作区修改
function hasChanges() {
  const status = getWorkingStatus();
  return status.modified > 0 || status.staged > 0;
}

// ============= 主要功能函数 =============

// 功能1：暂存当前修改
async function stashChanges() {
  console.log('\n💾 暂存当前修改\n');
  
  const status = getWorkingStatus();
  
  if (status.modified === 0 && status.staged === 0) {
    console.log('ℹ️  工作区没有需要暂存的修改\n');
    return;
  }
  
  console.log('当前工作区状态：');
  if (status.modified > 0) {
    console.log(`  📝 已修改：${status.modified} 个文件`);
  }
  if (status.staged > 0) {
    console.log(`  ✅ 已暂存：${status.staged} 个文件`);
  }
  if (status.untracked > 0) {
    console.log(`  ❓ 未跟踪：${status.untracked} 个文件`);
  }
  console.log('');
  
  // 选择暂存选项
  const optionPrompt = new Select({
    name: 'option',
    message: '请选择暂存选项：',
    choices: [
      { 
        name: 'default', 
        message: '💾 暂存所有修改（不包括未跟踪文件）\n          git stash push' 
      },
      { 
        name: 'message', 
        message: '📝 暂存并添加说明信息\n          git stash push -m "message"' 
      },
      { 
        name: 'include-untracked', 
        message: '📦 包含未跟踪的文件\n          git stash push -u' 
      },
      { 
        name: 'keep-index', 
        message: '🎯 仅暂存未暂存的文件（保持已暂存状态）\n          git stash push --keep-index' 
      },
      { 
        name: 'all', 
        message: '🗂️  包含所有文件（包括忽略的文件）\n          git stash push -a' 
      }
    ]
  });
  
  const option = await optionPrompt.run();
  
  let message = '';
  let args = ['stash', 'push'];
  
  switch (option) {
    case 'message':
      const inputPrompt = new Input({
        name: 'message',
        message: '请输入说明信息：',
        validate: (value) => value.trim() ? true : '说明信息不能为空'
      });
      message = await inputPrompt.run();
      args.push('-m', message);
      break;
    
    case 'include-untracked':
      args.push('-u');
      break;
    
    case 'keep-index':
      args.push('--keep-index');
      break;
    
    case 'all':
      args.push('-a');
      break;
  }
  
  // 执行 stash
  console.log('\n执行中...\n');
  const result = spawnSync('git', args, { stdio: 'inherit' });
  
  if (result.status === 0) {
    console.log('\n✅ 已成功暂存修改\n');
    
    // 显示当前 stash 数量
    const stashes = getStashList();
    console.log(`📊 当前 stash 数量：${stashes.length}\n`);
    console.log('💡 提示：使用 stash 命令管理你的暂存\n');
  } else {
    console.error('\n❌ 暂存失败\n');
    process.exit(1);
  }
}

// 功能2：管理已有暂存
async function manageStashes() {
  console.log('\n📋 管理已有暂存\n');
  
  const stashes = getStashList();
  
  if (stashes.length === 0) {
    console.log('ℹ️  当前没有任何暂存\n');
    return;
  }
  
  console.log(`当前有 ${stashes.length} 个暂存：\n`);
  
  // 显示 stash 列表并选择
  const choices = [
    ...stashes.map((stash, index) => ({
      name: stash.ref,
      message: `[${index}] ${stash.message} (${stash.time})`
    })),
    { name: '__separator__', message: '─'.repeat(60), disabled: true },
    { name: '__clear__', message: '🧹 清空所有暂存' },
    { name: '__cancel__', message: '← 返回' }
  ];
  
  const selectPrompt = new Select({
    name: 'stash',
    message: '请选择一个暂存：',
    choices
  });
  
  const selected = await selectPrompt.run();
  
  if (selected === '__cancel__') {
    return;
  }
  
  if (selected === '__clear__') {
    await clearAllStashes();
    return;
  }
  
  // 选择对暂存的操作
  await operateOnStash(selected);
}

// 对指定暂存执行操作
async function operateOnStash(stashRef) {
  const stashInfo = run(`git stash list | grep "${stashRef}"`);
  
  console.log(`\n选中的暂存：${stashInfo}\n`);
  
  const actionPrompt = new Select({
    name: 'action',
    message: `对 ${stashRef} 执行什么操作？`,
    choices: [
      { 
        name: 'pop', 
        message: '📤 恢复并删除 (pop)\n          应用暂存的修改到工作区，并从 stash 列表中删除' 
      },
      { 
        name: 'apply', 
        message: '📌 应用但保留 (apply)\n          应用暂存的修改到工作区，但保留在 stash 列表中' 
      },
      { 
        name: 'show', 
        message: '👀 查看内容 (show)\n          查看这个 stash 包含的修改' 
      },
      { 
        name: 'drop', 
        message: '🗑️  删除 (drop)\n          从 stash 列表中删除这个暂存' 
      },
      { 
        name: 'cancel', 
        message: '← 返回' 
      }
    ]
  });
  
  const action = await actionPrompt.run();
  
  if (action === 'cancel') {
    return;
  }
  
  switch (action) {
    case 'pop':
      await popStash(stashRef);
      break;
    
    case 'apply':
      await applyStash(stashRef);
      break;
    
    case 'show':
      await showStash(stashRef);
      break;
    
    case 'drop':
      await dropStash(stashRef);
      break;
  }
}

// pop stash
async function popStash(stashRef) {
  console.log(`\n📤 正在恢复 ${stashRef}...\n`);
  
  // 检查工作区是否干净
  if (hasChanges()) {
    console.log('⚠️  警告：工作区有未提交的修改\n');
    const confirmPrompt = new Confirm({
      name: 'confirm',
      message: '继续 pop 可能会导致冲突，是否继续？',
      initial: false
    });
    
    const confirmed = await confirmPrompt.run();
    if (!confirmed) {
      console.log('\n已取消操作\n');
      return;
    }
  }
  
  const result = spawnSync('git', ['stash', 'pop', stashRef], { stdio: 'inherit' });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功恢复 ${stashRef}\n`);
    const remaining = getStashList().length;
    console.log(`📊 剩余 stash 数量：${remaining}\n`);
  } else {
    console.error('\n❌ 恢复失败，可能存在冲突\n');
    console.log('💡 提示：解决冲突后，可以手动删除 stash：git stash drop ' + stashRef + '\n');
  }
}

// apply stash
async function applyStash(stashRef) {
  console.log(`\n📌 正在应用 ${stashRef}...\n`);
  
  if (hasChanges()) {
    console.log('⚠️  警告：工作区有未提交的修改\n');
    const confirmPrompt = new Confirm({
      name: 'confirm',
      message: '继续 apply 可能会导致冲突，是否继续？',
      initial: false
    });
    
    const confirmed = await confirmPrompt.run();
    if (!confirmed) {
      console.log('\n已取消操作\n');
      return;
    }
  }
  
  const result = spawnSync('git', ['stash', 'apply', stashRef], { stdio: 'inherit' });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功应用 ${stashRef}\n`);
    console.log('💡 提示：修改已应用到工作区，但 stash 仍保留在列表中\n');
  } else {
    console.error('\n❌ 应用失败，可能存在冲突\n');
  }
}

// show stash
async function showStash(stashRef) {
  console.log(`\n👀 查看 ${stashRef} 的内容：\n`);
  console.log('='.repeat(60));
  
  const result = spawnSync('git', ['stash', 'show', '-p', stashRef], { stdio: 'inherit' });
  
  console.log('='.repeat(60));
  console.log('');
  
  // 询问是否要对这个 stash 执行其他操作
  const nextPrompt = new Confirm({
    name: 'continue',
    message: '是否要对此 stash 执行其他操作？',
    initial: false
  });
  
  const shouldContinue = await nextPrompt.run();
  if (shouldContinue) {
    await operateOnStash(stashRef);
  }
}

// drop stash
async function dropStash(stashRef) {
  const stashInfo = run(`git stash list | grep "${stashRef}"`);
  
  console.log(`\n🗑️  准备删除：${stashInfo}\n`);
  console.log('⚠️  此操作不可恢复！\n');
  
  const confirmPrompt = new Confirm({
    name: 'confirm',
    message: `确认删除 ${stashRef} 吗？`,
    initial: false
  });
  
  const confirmed = await confirmPrompt.run();
  
  if (!confirmed) {
    console.log('\n已取消操作\n');
    return;
  }
  
  const result = spawnSync('git', ['stash', 'drop', stashRef], { stdio: 'inherit' });
  
  if (result.status === 0) {
    console.log(`\n✅ 已成功删除 ${stashRef}\n`);
    const remaining = getStashList().length;
    console.log(`📊 剩余 stash 数量：${remaining}\n`);
  } else {
    console.error('\n❌ 删除失败\n');
  }
}

// 清空所有 stashes
async function clearAllStashes() {
  const stashes = getStashList();
  
  console.log(`\n🧹 准备清空所有暂存（共 ${stashes.length} 个）\n`);
  console.log('⚠️  此操作不可恢复！\n');
  
  // 显示所有将被删除的 stash
  console.log('以下暂存将被删除：');
  stashes.forEach((stash, index) => {
    console.log(`  ${index + 1}. ${stash.message} (${stash.time})`);
  });
  console.log('');
  
  const confirmPrompt = new Input({
    name: 'confirm',
    message: `请输入 "yes" 确认清空所有 ${stashes.length} 个暂存：`,
    validate: (value) => value === 'yes' ? true : '请输入 "yes" 确认'
  });
  
  await confirmPrompt.run();
  
  const result = spawnSync('git', ['stash', 'clear'], { stdio: 'inherit' });
  
  if (result.status === 0) {
    console.log('\n✅ 已成功清空所有暂存\n');
  } else {
    console.error('\n❌ 清空失败\n');
  }
}

// 查看所有 stash 列表
async function viewStashList() {
  console.log('\n📋 Stash 列表\n');
  
  const stashes = getStashList();
  
  if (stashes.length === 0) {
    console.log('ℹ️  当前没有任何暂存\n');
    return;
  }
  
  console.log(`共有 ${stashes.length} 个暂存：\n`);
  console.log('─'.repeat(80));
  
  stashes.forEach((stash, index) => {
    console.log(`${(index).toString().padStart(3, ' ')}. ${stash.ref.padEnd(12)} ${stash.message}`);
    console.log(`     ${stash.time}`);
    console.log('─'.repeat(80));
  });
  
  console.log('');
}

// ============= 主函数 =============

async function main() {
  // 检查 git 仓库
  if (!isGitRepo()) {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }
  
  console.log('\n🗂️  Git Stash 管理器\n');
  
  // 显示当前状态
  const branch = getCurrentBranch();
  const status = getWorkingStatus();
  const stashes = getStashList();
  
  console.log('📊 当前状态：');
  if (branch) {
    console.log(`  • 分支：${branch}`);
  }
  if (status.modified > 0) {
    console.log(`  • 工作区：${status.modified} 个文件已修改`);
  }
  if (status.staged > 0) {
    console.log(`  • 暂存区：${status.staged} 个文件已暂存`);
  }
  if (status.untracked > 0) {
    console.log(`  • 未跟踪：${status.untracked} 个文件`);
  }
  console.log(`  • Stash 数量：${stashes.length} 个`);
  console.log('');
  
  // 主菜单
  const choices = [];
  
  // 根据状态动态生成菜单
  if (hasChanges()) {
    choices.push({
      name: 'stash',
      message: '💾 暂存当前修改 - 保存工作区和暂存区的修改'
    });
  }
  
  if (stashes.length > 0) {
    choices.push({
      name: 'manage',
      message: `📋 管理已有暂存 (${stashes.length}个) - 恢复、应用、查看或删除`
    });
    
    choices.push({
      name: 'list',
      message: '📜 查看暂存列表 - 显示所有 stash 的详细信息'
    });
  }
  
  if (choices.length === 0) {
    console.log('ℹ️  工作区干净，且没有已保存的暂存\n');
    console.log('💡 提示：当你有未提交的修改时，可以使用此命令暂存它们\n');
    return;
  }
  
  choices.push({
    name: 'cancel',
    message: '❌ 退出'
  });
  
  const mainPrompt = new Select({
    name: 'action',
    message: '请选择要执行的操作：',
    choices
  });
  
  try {
    const action = await mainPrompt.run();
    
    switch (action) {
      case 'stash':
        await stashChanges();
        break;
      case 'manage':
        await manageStashes();
        break;
      case 'list':
        await viewStashList();
        break;
      case 'cancel':
        console.log('\n已退出\n');
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
