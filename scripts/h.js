#!/usr/bin/env node
// h.js - 帮助命令：展示当前目录的所有命令及中文解释

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 命令说明映射
const commandDescriptions = {
  'b': '查看分支列表 - 列出所有本地分支',
  'bd': '删除本地分支和可选删除对应远程分支 - 交互式选择要删除的分支，支持安全删除和强制删除，可选择同时删除对应的远程分支',
  'c': '复制分支名到剪贴板 - 列出所有本地分支，选择后自动复制分支名到系统剪贴板',
  'ck': '切换或创建分支 - 无参数时交互式选择分支并切换，带参数时从当前分支创建并切换到新分支',
  'l': '查看提交历史 - 以图形化方式显示最近 20 条 git 提交记录，支持自定义参数',
  'p': '执行 git pull - 从远程仓库拉取最新代码',
  'push': '执行 git push - 推送本地提交到远程仓库，自动处理新分支的 upstream 设置',
  'res': 'Git Reset 工具 - 交互式管理提交回退、取消暂存、重置到远程分支等操作',
  's': '运行 npm scripts - 交互式选择并运行当前项目的 npm scripts，自动匹配包含当前分支名的脚本',
  'stash': 'Git Stash 管理器 - 交互式管理工作区暂存，支持暂存、恢复、查看和删除操作',
  'h': '帮助命令 - 展示所有可用命令及其中文解释（当前命令）',
};

// 获取 scripts 目录下的所有 .js 文件
function getScripts() {
  const scriptsDir = __dirname;
  const files = fs.readdirSync(scriptsDir);
  return files
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''))
    .sort();
}

// 主函数
function main() {
  const scripts = getScripts();
  
  console.log('\n📚 可用命令列表：\n');
  console.log('='.repeat(60));
  
  scripts.forEach((cmd, index) => {
    const description = commandDescriptions[cmd] || '暂无说明';
    const number = (index + 1).toString().padStart(2, ' ');
    console.log(`${number}. ${cmd.padEnd(8)} - ${description}`);
  });
  
  console.log('='.repeat(60));
}

main();
