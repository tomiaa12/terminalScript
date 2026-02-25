#!/bin/bash
cd ./scripts || exit

for file in *.js; do
  name="${file%.js}"
  chmod +x "$file"  # ✅ 给单个脚本执行权限
  sudo ln -sf "$PWD/$file" "/usr/local/bin/$name"
  echo "注册命令：$name"
done
