#!/usr/bin/env node
// gcb.js - 列出本地分支，中文提示，选中后复制分支名到剪贴板（macOS 使用 pbcopy）
// 依赖：enquirer。 如果尚未安装：npm install enquirer

import { execSync, spawnSync } from 'child_process';
import enquirer from 'enquirer';

function getBranches() {
  try {
    const out = execSync('git branch --no-color', { encoding: 'utf8' });
    const lines = out.split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean);
    if (lines.length === 0) return null;
    return lines.map(l => {
      const isCurrent = l.trim().startsWith('*');
      const name = l.replace(/^[\*\s]+/, '');
      return { name, isCurrent };
    });
  } catch (e) {
    return null;
  }
}

function copyToClipboardSync(text) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      // macOS 使用 pbcopy
      spawnSync('pbcopy', { input: text });
      return true;
    } else if (platform === 'win32') {
      // Windows 使用 clip
      spawnSync('clip', { input: text });
      return true;
    } else {
      // Linux 常见工具 xclip/xsel
      const tryXclip = spawnSync('xclip', ['-selection', 'clipboard'], { input: text });
      if (tryXclip.status === 0) return true;
      const tryXsel = spawnSync('xsel', ['--clipboard', '--input'], { input: text });
      if (tryXsel.status === 0) return true;
      return false;
    }
  } catch (e) {
    return false;
  }
}

(async function main() {
  const branches = getBranches();
  if (!branches) {
    console.error('错误：当前目录不是 git 仓库，或 git 命令执行失败。请在一个 git 仓库目录下运行此命令。');
    process.exit(1);
  }

  const choices = branches.map(b => ({
    name: b.name,
    message: (b.isCurrent ? `* ${b.name}（当前分支）` : b.name)
  }));

  const defaultIndex = branches.findIndex(b => b.isCurrent);
  const select = new enquirer.Select({
    name: 'branch',
    message: '请选择要复制的本地分支（上下键选择，回车确认，Ctrl+C 退出）',
    choices,
    initial: defaultIndex === -1 ? 0 : defaultIndex
  });

  try {
    const answer = await select.run(); // 分支名
    const ok = copyToClipboardSync(answer);
    if (ok) {
      console.log(`已复制分支名：${answer}`);
    } else {
      console.log(`无法写入剪贴板。分支名为：${answer}`);
    }
  } catch (err) {
    if (err === '') {
      console.log('\n已取消。');
      process.exit(1);
    }
    console.error('操作被取消或发生错误：', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
