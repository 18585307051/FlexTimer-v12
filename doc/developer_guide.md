# 开发指南 (Developer Guide)

**项目名称**: FlexTimer v12
**核心技术**: Electron + HTML5/CSS3/VanillaJS

---

## 1. 入门指南

### 1.1 克隆与安装
```bash
git clone https://github.com/18585307051/FlexTimer-v12.git
cd FlexTimer-v12
npm install
```

### 1.2 开发运行
- **调试模式**: 运行 `npm start` 启动程序。
- **开发者工具**: 默认开启 `Ctrl+Shift+I` 呼出 Electron 开发工具。

## 2. 代码逻辑解析

### 2.1 渲染流程
1. **初始化 (`DOMContentLoad`)**:
   - 加载 `localStorage` 数据。
   - 初始化 `agendas` 及 `settings` 变量。
   - 绑定全局事件监听。
2. **UI 同步 (`syncUI`)**:
   - 清空并重新生成议程列表 DOM。
   - 更新主计时器文字、颜色及进度条。
   - 根据 `settings` 应用 CSS 变量。

### 2.2 计时状态机
计时器状态存放在全局 `timerStatus` 中：
- `default`: 计时结束或未开始。
- `counting`: 正在 3-2-1 准备中。
- `started`: 议程正在计时。
- `paused`: 议程已暂停。

### 2.3 数据的存储与归档
- **实时数据 (`flex_v103_data`)**: 每当议程发生增删改移，立即通过 `saveData()` 进行覆盖写。
- **历史记录 (`flex_timer_history`)**: 议程完成或跳过时，调用 `saveToHistory()`，将数据按 `YYYY-MM-DD` 格式归档。

## 3. 玻璃拟态设计约定

### 3.1 CSS 变量
所有视觉调整必须通过修改 `:root` 变量完成：
```css
:root {
    --blue: #0078d4;
    --glass-bg: rgba(255, 255, 255, 0.4);
    --glass-border: rgba(255, 255, 255, 0.2);
    --backdrop-blur: 20px;
}
```

### 3.2 层级规范
- 底层: `#app-container`（带 `backdrop-filter`）。
- 中层: `.content-zone`（主要显示区）。
- 顶层: `.popup-overlay`（所有遮罩、弹窗）。

## 4. 常见问题排查 (FAQ)

- **Q: 计时器不走字？**
  - A: 检查 `script.js` 中的 `tick()` 函数是否被触发，确认 `setInterval` 没有被重复销毁或清理。
- **Q: 样式没刷新？**
  - A: 检查 CSS 变量名是否正确拼写，确认 `syncUI()` 在设置更变后被调用。
- **Q: 字体颜色在警告/超时状态下变红?**
  - A: v12 已修复此问题。确保 CSS 中的 `.warning` 和 `.overtime` 类没有使用 `!important` 覆盖用户设置。
- **Q: 倒计时动画层级异常?**
  - A: 检查 `#countdown-overlay` 的 `z-index` 是否为 2000,`#timer-display` 是否设置了 `position: relative` 和 `z-index: 10`。

## 5. 打包发布
本项目使用 `electron-builder` 进行打包。
```bash
npm run build
```
生成的 EXE 文件将自动包含主程序、资源文件及所有依赖。

## 6. 最新更新 (v12.0.0 - 2026-02-05)
- 修复了字体颜色设置在警告和超时状态下被强制覆盖的问题
- 优化了计时器显示的 z-index 层级,确保倒计时动画正确显示
- 改进了议程添加逻辑,移除了添加次数限制
- 完善了错误处理和用户反馈机制
