#!/usr/bin/env node
// gp.js - 交互式设置或取消 Git 全局代理

import { spawnSync } from 'child_process';
import Enquirer from 'enquirer';

const { Select, Input } = Enquirer;

function runGitConfig(args) {
  return spawnSync('git', ['config', '--global', ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
}

function validatePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? true
    : '请输入 1-65535 之间的端口号';
}

async function getPort() {
  const prompt = new Input({
    name: 'port',
    message: '请输入代理端口号：',
    initial: '7890',
    validate: validatePort
  });

  return (await prompt.run()).trim() || '7890';
}

function setProxy(protocol, port) {
  const httpProxy = `${protocol === 'http' ? 'http' : 'socks5'}://127.0.0.1:${port}`;
  const httpsProxy = `${protocol === 'http' ? 'https' : 'socks5'}://127.0.0.1:${port}`;
  const httpResult = runGitConfig(['http.proxy', httpProxy]);
  const httpsResult = runGitConfig(['https.proxy', httpsProxy]);

  if (httpResult.status !== 0 || httpsResult.status !== 0) {
    const message = httpResult.stderr || httpsResult.stderr || '未知错误';
    console.error(`\n❌ Git 代理设置失败：${message.trim()}\n`);
    process.exit(1);
  }

  console.log('\n✅ Git 全局代理设置成功：');
  console.log(`   HTTP:  ${httpProxy}`);
  console.log(`   HTTPS: ${httpsProxy}\n`);
}

function unsetProxy() {
  const httpResult = runGitConfig(['--unset', 'http.proxy']);
  const httpsResult = runGitConfig(['--unset', 'https.proxy']);
  const failed = [httpResult, httpsResult].find(result => result.status !== 0 && result.status !== 5);

  if (failed) {
    console.error(`\n❌ 取消 Git 代理失败：${failed.stderr.trim() || '未知错误'}\n`);
    process.exit(1);
  }

  console.log('\n✅ 已取消 Git 全局代理\n');
}

async function main() {
  const prompt = new Select({
    name: 'action',
    message: '请选择 Git 代理操作：',
    choices: [
      { name: 'http', message: '设置 HTTP/HTTPS 代理' },
      { name: 'socks5', message: '设置 SOCKS5 代理' },
      { name: 'unset', message: '取消代理' },
      { name: 'cancel', message: '取消操作' }
    ]
  });

  try {
    const action = await prompt.run();

    if (action === 'cancel') {
      console.log('\n已取消操作\n');
      return;
    }

    if (action === 'unset') {
      unsetProxy();
      return;
    }

    const port = await getPort();
    setProxy(action, port);
  } catch (error) {
    if (error === '') {
      console.log('\n\n已取消操作\n');
      return;
    }

    console.error('\n操作出错：', error?.message || error);
    process.exit(1);
  }
}

main();
