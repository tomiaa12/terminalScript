#!/usr/bin/env node
// push.js - 执行 git push

import { spawnSync } from 'child_process';

// 检查是否在 git 仓库
function isGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  return result.status === 0;
}

// 获取当前分支名
function getCurrentBranch() {
  const result = spawnSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  return result.stdout.trim();
}

function main() {
  if (!isGitRepo()) {
    console.error('❌ 当前目录不是 Git 仓库，请先进入一个仓库目录。');
    process.exit(1);
  }

  console.log('🚀 正在执行 git push...\n');
  const result = spawnSync('git', ['push'], { 
    stdio: 'inherit',
    encoding: 'utf8'
  });

  // 如果 push 失败，尝试检查是否是因为没有 upstream
  if (result.status !== 0) {
    // 再次执行 git push 来捕获错误信息
    const checkResult = spawnSync('git', ['push'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const errorOutput = checkResult.stderr || '';
    
    // 检查是否是因为没有 upstream 分支
    if (errorOutput.includes('has no upstream branch')) {
      const currentBranch = getCurrentBranch();
      
      if (currentBranch) {
        console.log(`\n📝 检测到新分支，正在设置 upstream 并推送...`);
        console.log(`   分支: ${currentBranch}\n`);
        
        const upstreamResult = spawnSync('git', ['push', '--set-upstream', 'origin', currentBranch], {
          stdio: 'inherit'
        });
        
        process.exit(upstreamResult.status || 0);
      } else {
        console.error('❌ 无法获取当前分支名');
        process.exit(1);
      }
    } else {
      // 其他错误，直接退出
      process.exit(result.status);
    }
  } else {
    process.exit(0);
  }
}

main();
