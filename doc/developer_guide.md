# 开发指南 (Developer Guide)

**项目名称**: FlexTimer v11
**最低要求**:
- 现代浏览器 (Chrome/Edge/Firefox)
- 本地 Web 服务器 (推荐 VS Code Live Server 插件)

## 1. 快速开始 (Getting Started)

### 1.1 获取代码
从 GitHub 克隆仓库：
```bash
git clone https://github.com/18585307051/FlexTimer-v11.git
cd FlexTimer-v11
```

### 1.2 运行项目
双击打开 `index.html` 即可在浏览器中预览，或使用 Visual Studio Code 的 `Live Server` 插件以获得实时刷新体验。

### 1.3 开发流程
1.  **修改代码**: 在 `index.html` `js/script.js` 或 `css/style.css` 中进行修改。
2.  **验证**: 刷新浏览器，查看功能是否符合预期。
3.  **调试**: 使用 Chrome 开发者工具 (`F12`) 查看 Console 输出和 Sources 断点。
4.  **复现问题**: 确保在清空 `localStorage` 后重试（`F12 -> Application -> Local Storage -> Clear All`）。

## 2. 代码结构说明 (Project Logic)

### 2.1 核心方法
- `syncUI()`: **必调函数**。任何数据的变更（包括排序、添加、删除）都必须紧随 `syncUI()` 调用以刷新视图。
- `showPopup(type)`: **弹窗路由**。控制弹窗显示逻辑，type 为弹窗 ID 后缀。
- `tick()`: **计时核心**。每秒运行一次，处理剩余时间和超时逻辑。

### 2.2 样式约定
- **主题色**: `--blue` (`#0078d4`) 和 `--bg-opacity` 必须通过 CSS 变量修改。
- **布局**: 主容器 `#app-container` 使用 `flex` 布局，侧边栏 `#sidebar` 使用过渡动画 (`transition: width`)。
- **重要类名**:
    - `.card`: 议程卡片。
    - `.btn`: 通用按钮。
    - `.active`: 当前进行中的议程，高亮显示。

## 3. 注意事项 (Notes)
- **Sortable.js**: 项目依赖 CDN 引入的 Sortable.js，若需离线部署请下载并在头部本地引入。
- **本地存储**: 避免修改 `localStorage` 的键名 (`flex_v103_data` 等)，以免造成版本不兼容导致数据丢失。
- **Electron 集成**: 若要打包为桌面应用，请取消 JS 中 `ipcRenderer` 相关代码的注释，并在 `main.js` 中处理 `set-opacity` 等事件。

## 4. 提交规范 (Contribution)
- **提交信息**: 必须简明扼要，如 `feat: add export csv` 或 `fix: correct overtime calculation`。
- **分支管理**: `main` 分支为稳定版，开发新功能请切换到 `develop` 或 `feature/xxx` 分支。

## 5. 开发测试结果都需要进行版本记录并在外部打包（不做上传github）