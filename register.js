#!/usr/bin/env node
import { readdirSync, writeFileSync, existsSync, unlinkSync, symlinkSync } from 'fs'
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

function registerCommand(name, scriptPath, binDir, nodeModulesDir) {
  const unixPath = scriptPath.replace(/\\/g, '/')
  const unixNodeModules = nodeModulesDir.replace(/\\/g, '/')
  if (isWindows) {
    // NODE_PATH 让脚本在任意目录执行时都能找到依赖
    const cmdContent = `@SET "NODE_PATH=${nodeModulesDir}"\r\n@node "${scriptPath}" %*\r\n`
    writeFileSync(join(binDir, `${name}.cmd`), cmdContent)
    // Git Bash / MSYS2 兼容
    const shContent = `#!/bin/sh\nNODE_PATH="${unixNodeModules}" exec node "${unixPath}" "$@"\n`
    writeFileSync(join(binDir, name), shContent)
  } else {
    const linkPath = join(binDir, name)
    if (existsSync(linkPath)) unlinkSync(linkPath)
    try {
      symlinkSync(scriptPath, linkPath)
      spawnSync('chmod', ['+x', scriptPath])
    } catch {
      // 权限不足时尝试 sudo
      spawnSync('sudo', ['ln', '-sf', scriptPath, linkPath], { stdio: 'inherit' })
      spawnSync('sudo', ['chmod', '+x', scriptPath], { stdio: 'inherit' })
    }
  }
}

/**
 * @param {string} [scriptsDir] 脚本目录，默认为本项目 scripts/
 */
export function register(scriptsDir = join(__dirname, 'scripts')) {
  if (!existsSync(scriptsDir)) {
    console.error(`❌ 找不到脚本目录: ${scriptsDir}`)
    process.exit(1)
  }

  const nodeModulesDir = join(scriptsDir, '..', 'node_modules')
  if (!existsSync(nodeModulesDir)) {
    console.error(`❌ 找不到 node_modules: ${nodeModulesDir}`)
    console.error('   请先运行: pnpm install 或 npm install')
    process.exit(1)
  }

  const binDir = getNpmBinDir()
  const scripts = readdirSync(scriptsDir).filter(f => f.endsWith('.js'))

  if (scripts.length === 0) {
    console.log('⚠️  没有找到可注册的脚本')
    return
  }

  console.log('\n📝 正在注册命令...\n')

  for (const file of scripts) {
    const name = file.replace('.js', '')
    registerCommand(name, join(scriptsDir, file), binDir, nodeModulesDir)
    console.log(`  ✅ ${name}`)
  }

  console.log(`\n🎉 已注册 ${scripts.length} 个命令！`)
  console.log(`\n   命令目录 : ${binDir}`)
  console.log(`   脚本来源 : ${scriptsDir}`)
  if (!isWindows) {
    console.log('\n💡 本地修改脚本后即时生效，无需重新注册')
  }
}

// 作为独立脚本直接运行时执行
if (process.argv[1] === __filename) register()
