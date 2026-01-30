# 架构设计文档 (Architecture Design)

**项目名称**: FlexTimer v11
**架构类型**: 单页面应用程序 (SPA)
**技术栈**: HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+)

## 1. 总体架构 (System Architecture)
FlexTimer v11 采用模块化前端设计，不依赖复杂的构建工具（如 Webpack/React），直接由浏览器解析运行。其核心思想是 **DOM 操作即UI**，**LocalStorage 即数据库**。

### 1.1 文件结构 (Project Structure)
```
FlexTimer-Project/
├── index.html       # 视图入口 (View)
├── css/
│   └── style.css    # 视觉表现 (Presentation)
├── js/
│   └── script.js    # 业务逻辑 (Controller & Model)
├── docs/            # 文档
└── README.md        # 项目简介
```

## 2. 核心模块 (Modules)

### 2.1 数据模型 (Model)
应用的核心数据是 `agendas` 数组，存储在全局变量和 `localStorage` 中。每个议程项对象结构如下：
```javascript
{
    title: "议题名称",   // String
    rem: 120,           // Number (剩余秒数)
    plan: 2,            // Number (计划分钟数，静态)
    status: "ready",    // String ("ready" | "done")
    used: 0,            // Number (实际已用秒数)
    overtime: 0         // Number (超时秒数)
}
```

### 2.2 视图层 (View)
- **HTML**: 使用语义化标签构建布局。主要包括 `sidebar` (侧边栏)、`timer-zone` (计时区)、`popup-overlay` (弹窗层)。
- **CSS**: 
    - 采用 CSS Variables (`:root`) 定义全局主题色（如 `--blue`）。
    - 使用 Flexbox 进行主要布局。
    - 利用 `backdrop-filter` 实现磨砂玻璃效果。
    - 响应式设计适配深色模式 (`@media (prefers-color-scheme: dark)`).

### 2.3 控制器 (Controller)
`script.js` 负责所有的交互逻辑：
- **`syncUI()`**: 核心渲染函数。每次数据变更（添加、删除、排序、计时更新）后调用，重新生成 `list-zone` 的 DOM。
- **`tick()`**: 计时器的主循环，每秒执行一次，处理倒计时扣减、超时累加、状态判断。
- **`handleTimer()`**: 状态机控制，处理 开始 <-> 暂停 <-> 继续 的逻辑切换。

## 3. 关键技术点 (Key Technologies)

### 3.1 状态持久化
利用 `localStorage` 存储两个关键数据：
1.  **用户偏好**: 字体颜色、字体大小、警告阈值 (`flex_timer_font_size` 等)。
2.  **业务数据**: 完整的议程列表 (`flex_v103_data`)。
这保证了页面刷新或意外关闭后，用户的工作流不会丢失。

### 3.2 拖拽排序
集成第三方库 `Sortable.js`，通过简单的配置即可实现列表项的拖拽排序。
```javascript
new Sortable(el, {
    onEnd: (evt) => {
        // 更新数据模型并重新渲染
        agendas.splice(...)
        syncUI();
    }
});
```

### 3.3 桌面端适配 (Electron Ready)
虽然本项目是纯 Web 项目，但预留了 Electron 的集成接口：
- CSS 中的 `-webkit-app-region: drag` 用于定义可拖拽区域。
- JS 中注释掉的 `ipcRenderer` 代码块用于与主进程通信（如控制窗口透明度、穿透等）。

## 4. 扩展性 (Scalability)
- **样式扩展**: 只需修改 `style.css` 中的 CSS 变量即可更换主题。
- **功能扩展**: 业务逻辑集中在 `script.js`，新增功能（如网络同步）只需在 `Model` 层增加接口。
