#!/usr/bin/env node
import { readdirSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isWindows = os.platform() === 'win32'

function getNpmBinDir() {
  const result = spawnSync('npm', ['prefix', '-g'], { encoding: 'utf8', shell: true })
  if (result.status !== 0) {
    console.error('❌ 无法获取 npm 全局路径，请确认 npm 已安装')
    process.exit(1)
  }
  const prefix = result.stdout.trim()
  return isWindows ? prefix : join(prefix, 'bin')
}

function removeCommand(name, binDir) {
  let removed = false
  if (isWindows) {
    const cmdPath = join(binDir, `${name}.cmd`)
    const shPath = join(binDir, name)
    if (existsSync(cmdPath)) { unlinkSync(cmdPath); removed = true }
    if (existsSync(shPath)) unlinkSync(shPath)
  } else {
    const linkPath = join(binDir, name)
    if (existsSync(linkPath)) {
      try {
        unlinkSync(linkPath)
        removed = true
      } catch {
        spawnSync('sudo', ['rm', '-f', linkPath], { stdio: 'inherit' })
        removed = true
      }
    }
  }
  return removed
}

/**
 * @param {string} [scriptsDir] 脚本目录，默认为本项目 scripts/
 */
export function unregister(scriptsDir = join(__dirname, 'scripts')) {
  if (!existsSync(scriptsDir)) {
    console.error(`❌ 找不到脚本目录: ${scriptsDir}`)
    process.exit(1)
  }

  const binDir = getNpmBinDir()
  const scripts = readdirSync(scriptsDir).filter(f => f.endsWith('.js'))

  if (scripts.length === 0) {
    console.log('⚠️  没有找到可卸载的脚本')
    return
  }

  console.log('\n🗑️  正在卸载命令...\n')

  let count = 0
  for (const file of scripts) {
    const name = file.replace('.js', '')
    const removed = removeCommand(name, binDir)
    if (removed) {
      console.log(`  🗑️  ${name}`)
      count++
    }
  }

  if (count > 0) {
    console.log(`\n✅ 已卸载 ${count} 个命令`)
  } else {
    console.log('\n⚠️  未找到已注册的命令，可能从未注册或已卸载')
  }
}

// 作为独立脚本直接运行时执行
if (process.argv[1] === __filename) unregister()
