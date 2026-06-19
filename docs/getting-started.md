# Getting Started

目标：10 分钟内创建一个 OmniCore 项目，让角色出现在屏幕上，并能左右移动和 jump。

## 0. 准备

```bash
node --version
npm --version
```

建议使用 Node.js 20 或更高版本。Windows PowerShell 5.1 下不要串联 `&&`，直接逐条执行命令即可。

## 1. 创建项目

```bash
npx create-omnicore-app my-first-game --template platformer
cd my-first-game
npm install
npm run dev
```

浏览器打开终端显示的 Vite 地址。默认 platformer 模板会显示玩家、地面和敌人。

## 2. 让角色移动和跳跃

打开 `src/main.js`，确认场景里有类似逻辑：

```js
if (this.input.keyboard.isDown('ArrowLeft')) this.player.x -= 2;
if (this.input.keyboard.isDown('ArrowRight')) this.player.x += 2;
if (this.input.keyboard.isDown('Space') && this.player.y >= 192) this.velocityY = -8;
```

按 `ArrowLeft`、`ArrowRight` 移动角色，按 `Space` jump。看到角色离开地面再落回平台，就完成第一关。

## 3. 改一个数验证热更新

把跳跃速度从 `-8` 改成 `-12`，保存文件，浏览器会自动刷新。角色跳得更高说明开发环境和模板都已跑通。

## 4. 30 分钟内应完成的检查

- `npm run dev` 能启动。
- 浏览器没有红色 console error。
- 角色能左右移动。
- 角色能 jump 并落回平台。
- 修改 `src/main.js` 后页面自动刷新。

## 常见问题

`npm install` 失败：删除项目内 `node_modules` 和 `package-lock.json` 后重试，仍失败时检查 Node.js 版本。

页面空白：打开浏览器控制台，优先看资源 404；确认 `assets/sprites/default/` 已生成。

按键无效：先点击游戏画布让浏览器聚焦，再按方向键和 `Space`。
