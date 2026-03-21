#!/usr/bin/env node
/**
 * npx @tomiaa/terminal-script           → 全局安装并注册命令
 * npx @tomiaa/terminal-script register  → 同上
 * npx @tomiaa/terminal-script unregister → 卸载命令并全局卸载包
 */
import { spawnSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isWindows = os.platform() === 'win32'
const PACKAGE_NAME = '@tomiaa/terminal-script'

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { shell: true, encoding: 'utf8', ...opts })
}

function getGlobalScriptsDir() {
  const result = run('npm', ['root', '-g'])
  if (result.status !== 0) {
    console.error('❌ 无法获取 npm 全局模块路径')
    process.exit(1)
  }
  return join(result.stdout.trim(), '@tomiaa', 'terminal-script', 'scripts')
}

async function globalInstall() {
  console.log(`\n📦 正在全局安装 ${PACKAGE_NAME}...\n`)
  const result = run('npm', ['install', '-g', PACKAGE_NAME], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('\n❌ 全局安装失败，请检查网络或使用管理员权限重试')
    process.exit(1)
  }
}

async function globalUninstall() {
  console.log(`\n📦 正在全局卸载 ${PACKAGE_NAME}...\n`)
  run('npm', ['uninstall', '-g', PACKAGE_NAME], { stdio: 'inherit' })
}

async function main() {
  const cmd = process.argv[2]

  if (cmd === 'unregister') {
    // 先卸载注册的命令，再卸载全局包
    const scriptsDir = getGlobalScriptsDir()
    const { unregister } = await import('./unregister.js')
    unregister(scriptsDir)
    await globalUninstall()
    console.log('\n✅ 全部卸载完成')

  } else if (!cmd || cmd === 'register') {
    // 先全局安装（确保是最新版），再注册命令
    await globalInstall()
    const scriptsDir = getGlobalScriptsDir()
    const { register } = await import('./register.js')
    register(scriptsDir)
    console.log(`\n💡 后续保持更新: npm update -g ${PACKAGE_NAME}`)

  } else {
    console.log(`
用法: npx ${PACKAGE_NAME} [命令]

命令:
  register    全局安装包并注册所有终端命令 (默认)
  unregister  卸载所有终端命令并全局卸载包
`)
  }
}

main()
