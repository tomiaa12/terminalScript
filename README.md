# terminal-script

> 将常用 Git 操作和开发工作流封装为极简终端命令，支持 Windows / macOS / Linux。

## 安装

### 方式一：npx（推荐，无需克隆仓库）

```bash
npx @tomiaa/terminal-script
```

执行后会自动全局安装包并注册所有命令。后续保持命令为最新版本：

```bash
npm update -g @tomiaa/terminal-script
```

### 方式二：克隆仓库本地注册

```bash
git clone https://github.com/tomiaa12/terminalScript.git
cd terminalScript
npm install
npm run register
```

本地修改脚本后**无需重新注册**，改动即时生效。

## 卸载

```bash
npx @tomiaa/terminal-script unregister
```

或在仓库目录下：

```bash
npm run unregister
```

---

## 命令一览

| 命令    | 说明                                                 |
| ------- | ---------------------------------------------------- |
| `h`     | 在终端输出所有可用命令及说明                         |
| `b`     | 查看本地分支列表                                     |
| `bd`    | 交互式删除本地分支，可选同时删除远程分支             |
| `c`     | 从分支列表中选择并复制分支名到剪贴板                 |
| `ck`    | 无参数时交互式切换分支；带参数时从当前分支新建并切换 |
| `gp`    | 交互式设置或取消 Git 全局代理，默认端口为 7890       |
| `l`     | 图形化查看最近 20 条提交记录                         |
| `p`     | `git pull`                                           |
| `push`  | `git push`，新分支自动设置 upstream                  |
| `res`   | 交互式 Git Reset 工具                                |
| `s`     | 交互式选择并运行当前项目的 npm scripts               |
| `stash` | 交互式 Git Stash 管理器                              |

---

## 命令详情

### `ck` — 切换 / 新建分支

```bash
ck          # 交互式选择并切换到已有分支
ck feature  # 从当前分支创建 feature 分支并切换
```

### `push` — 智能推送

自动检测是否为新分支，如果远程没有对应的 upstream 则自动执行：

```bash
git push --set-upstream origin <当前分支名>
```

### `gp` — Git 全局代理

交互式选择 HTTP/HTTPS 代理、SOCKS5 代理或取消代理。设置代理时可手动输入端口，默认端口为 `7890`。

### `res` — Git Reset 工具

提供四种操作：

- **回退提交** — 选择回退次数（1 / 2 / 3 / 5 / 自定义），支持 `soft` / `mixed` / `hard` 三种模式
- **取消暂存文件** — 多选已暂存的文件，从暂存区移出
- **重置到远程分支** — 拉取最新远程状态后执行 reset，显示本地与远程的差异
- **重置到指定提交** — 从最近 10 条提交列表中选择，或手动输入 commit hash

### `s` — npm Scripts 选择器

列出当前目录 `package.json` 中的所有 scripts，自动将包含**当前 Git 分支名**的脚本作为默认选项（适合多环境构建场景）。

### `stash` — Stash 管理器

根据当前工作区状态动态展示菜单：

- **暂存当前修改** — 支持添加说明、包含未跟踪文件、仅暂存未暂存部分等选项
- **管理已有暂存** — 对单条 stash 执行 pop / apply / 查看 diff / 删除
- **查看暂存列表** — 显示所有 stash 的详细信息

---

## 环境要求

- Node.js >= 16
- Git

## License

MIT
