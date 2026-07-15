#!/usr/bin/env node
// del-branches.js - 删除本地分支 & 可选删除对应远程分支（ESM + enquirer 全量导入）
// 使用：保存为 ~/scripts/del-branches.js，安装依赖：pnpm/npm install enquirer
// 然后 chmod +x ~/scripts/del-branches.js 并 ln -s 到 /usr/local/bin/del-branches（或你喜欢的名字）

import { execSync, spawnSync } from 'child_process';
import Enquirer from 'enquirer';
const { MultiSelect, Confirm } = Enquirer;

// 执行命令并返回 stdout（字符串），若失败抛出
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

// 获取当前分支名
function getCurrentBranch() {
  try {
    return run('git rev-parse --abbrev-ref HEAD');
  } catch {
    return null;
  }
}

// 获取本地分支列表（不包含 HEAD 指向的当前分支）
function getLocalBranches() {
  try {
    // 使用 for-each-ref 保证兼容性
    const out = run("git for-each-ref --format='%(refname:short)' refs/heads");
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// 获取远程分支列表（形如 origin/branch）
function getRemoteBranches() {
  try {
    const out = run("git for-each-ref --format='%(refname:short)' refs/remotes");
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// 本地删除（尝试 -d 安全删除），返回 {succ: [], fail: [{name, error}]}
function deleteLocalBranches(branches) {
  const succ = [];
  const fail = [];
  for (const b of branches) {
    try {
      // 使用 spawnSync 来继承 stdio，以便 git 的详细信息显示，但这里我们先尝试静默执行并捕获错误
      const r = spawnSync('git', ['branch', '-d', b], { encoding: 'utf8' });
      if (r.status === 0) {
        succ.push(b);
      } else {
        // 捕获 stderr
        fail.push({ name: b, error: (r.stderr || r.stdout || '删除失败') });
      }
    } catch (e) {
      fail.push({ name: b, error: e.message || String(e) });
    }
  }
  return { succ, fail };
}

// 强制删除
function forceDeleteLocalBranches(branches) {
  const succ = [];
  const fail = [];
  for (const b of branches) {
    try {
      const r = spawnSync('git', ['branch', '-D', b], { encoding: 'utf8' });
      if (r.status === 0) succ.push(b);
      else fail.push({ name: b, error: (r.stderr || r.stdout || '强制删除失败') });
    } catch (e) {
      fail.push({ name: b, error: e.message || String(e) });
    }
  }
  return { succ, fail };
}

// 删除远程分支：传入形如 'origin/feature/a' 的 remoteRef，拆成 remote + branch
function deleteRemoteBranches(remoteRefs) {
  const succ = [];
  const fail = [];
  for (const ref of remoteRefs) {
    const idx = ref.indexOf('/');
    if (idx === -1) {
      fail.push({ name: ref, error: '无法解析 remote/branch' });
      continue;
    }
    const remote = ref.slice(0, idx);
    const branch = ref.slice(idx + 1);
    try {
      // git push <remote> --delete <branch>
      const r = spawnSync('git', ['push', remote, '--delete', branch], { encoding: 'utf8' });
      if (r.status === 0) succ.push(ref);
      else fail.push({ name: ref, error: (r.stderr || r.stdout || '删除远程分支失败') });
    } catch (e) {
      fail.push({ name: ref, error: e.message || String(e) });
    }
  }
  return { succ, fail };
}

async function main() {
  // 检查是否在 git 仓库
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  const current = getCurrentBranch();
  const localBranches = getLocalBranches().filter(b => b !== current); // 不允许删除当前分支
  if (!localBranches.length) {
    console.log('没有可删除的本地分支（除了当前分支）。');
    process.exit(0);
  }

  // 构建 choices，添加一个 "全选" 选项
  const choices = [
    { name: '__all__', message: '🔘 全选（选择此项代表选择所有分支）' },
    ...localBranches.map(b => ({ name: b, message: b }))
  ];

  const ms = new MultiSelect({
    name: 'branches',
    message: `请选择要删除的本地分支（当前分支：${current}，不能删除当前分支）。按空格选择，回车确认，Ctrl+C 取消：`,
    choices
  });

  let selected;
  try {
    selected = await ms.run(); // 返回选择的 name 数组
  } catch (e) {
    if (e === '') {
      console.log('\n已取消。');
      process.exit(1);
    }
    console.error('操作出错：', e && e.message ? e.message : e);
    process.exit(1);
  }

  // 处理全选
  if (selected.includes('__all__')) {
    selected = localBranches.slice(); // 全部选中
  } else {
    // 过滤掉可能误包含的 __all__
    selected = selected.filter(s => s !== '__all__');
  }

  if (!selected.length) {
    console.log('未选择任何分支，已取消。');
    process.exit(0);
  }

  console.log('即将删除以下本地分支：');
  selected.forEach(b => console.log(' -', b));

  // 执行本地删除（先用 -d，失败则自动强制 -D）
  const { succ, fail } = deleteLocalBranches(selected);

  if (succ.length) {
    console.log('\n已成功删除（本地）：');
    succ.forEach(b => console.log(' ✅', b));
  }
  if (fail.length) {
    console.log('\n无法安全删除，自动强制删除：');
    fail.forEach(f => console.log(' ⚠️', f.name, ' — ', f.error.toString().trim()));
    const failedNames = fail.map(x => x.name);
    const { succ: succ2, fail: fail2 } = forceDeleteLocalBranches(failedNames);
    if (succ2.length) {
      console.log('\n强制删除成功：');
      succ2.forEach(b => console.log(' ✅', b));
    }
    if (fail2.length) {
      console.log('\n强制删除失败：');
      fail2.forEach(f => console.log(' ❌', f.name, ' — ', f.error.toString().trim()));
    }
    succ.push(...succ2);
  }

  // 准备远程分支候选：找出远程 refs 包含已删除的本地分支名的那些
  const deletedLocal = succ.slice(); // 使用最终成功删除的本地分支名（不包含仍失败的）
  if (!deletedLocal.length) {
    console.log('\n没有本地分支被删除，跳过远程删除。');
    process.exit(0);
  }

  // 询问是否继续删除远程分支
  const askRemote = await Confirm.prompt({
    message: `是否要继续删除与已删除本地分支对应的远程分支？ (${deletedLocal.length} 个，Ctrl+C 可取消)`,
    initial: false
  });
  if (!askRemote) {
    console.log('已完成本地删除，未进行远程删除。');
    process.exit(0);
  }

  // 获取远程 refs
  const remoteRefs = getRemoteBranches(); // 例如 ['origin/HEAD', 'origin/main', 'origin/feature/x']
  // 找到与 deletedLocal 对应的 remote refs（尾部等于分支名）
  const candidates = [];
  for (const r of remoteRefs) {
    for (const b of deletedLocal) {
      if (r.endsWith('/' + b)) {
        candidates.push(r);
        break;
      }
    }
  }
  // 去重
  const uniqCandidates = [...new Set(candidates)];

  if (!uniqCandidates.length) {
    console.log('没有发现对应的远程分支可删除（基于 refs 列表匹配）。');
    process.exit(0);
  }

  // 为远程删除提供多选（也支持全选）
  const remoteChoices = [
    { name: '__all__', message: '🔘 全选（选择此项代表选择所有远程分支）' },
    ...uniqCandidates.map(r => ({ name: r, message: r }))
  ];

  const ms2 = new MultiSelect({
    name: 'remotes',
    message: '请选择要删除的远程分支（多选，空格选择，回车确认，Ctrl+C 取消）：',
    choices: remoteChoices
  });

  let remoteSelected;
  try {
    remoteSelected = await ms2.run();
  } catch (e) {
    if (e === '') {
      console.log('\n已取消远程删除。');
      process.exit(1);
    }
    console.error('操作出错：', e && e.message ? e.message : e);
    process.exit(1);
  }

  if (remoteSelected.includes('__all__')) {
    remoteSelected = uniqCandidates.slice();
  } else {
    remoteSelected = remoteSelected.filter(s => s !== '__all__');
  }

  if (!remoteSelected.length) {
    console.log('未选择任何远程分支，操作结束。');
    process.exit(0);
  }

  // 执行远程删除
  console.log('\n开始删除远程分支：');
  const { succ: remoteSucc, fail: remoteFail } = deleteRemoteBranches(remoteSelected);

  if (remoteSucc.length) {
    console.log('\n远程删除成功：');
    remoteSucc.forEach(r => console.log(' ✅', r));
  }
  if (remoteFail.length) {
    console.log('\n远程删除失败：');
    remoteFail.forEach(f => console.log(' ❌', f.name, ' — ', f.error.toString().trim()));
  }

  console.log('\n操作完成。');
  process.exit(0);
}

main().catch(e => {
  console.error('致命错误：', e && e.message ? e.message : e);
  process.exit(1);
});
