// ===== 数据模型 =====
let agendas = [];
let currentIndex = 0;
let isRunning = false;
let isPaused = false;
let timerInterval = null;
let overtimeEnabled = true;
let countdownPhase = 0; // 0: 无, 3/2/1: 倒数
let historyData = {}; // 日期 -> 议程列表

// ===== 用户设置 =====
let settings = {
    timerColor: '#00ff00',
    timerSize: 80,
    uiColor: '#ffffff',
    uiSize: 14,
    opacity: 100,
    warningSeconds: 10,
    soundEnabled: true,
    alwaysOnTop: false
};

// ===== DOM 元素 =====
const $ = (id) => document.getElementById(id);

const elements = {
    timerDisplay: $('timer-display'),
    currentTitle: $('current-agenda-title'),
    timerStatus: $('timer-status'),
    listZone: $('list-zone'),
    sidebar: $('sidebar'),
    popupOverlay: $('popup-overlay'),
    btnStart: $('btn-start'),
    btnSkip: $('btn-skip'),
    btnOvertime: $('btn-overtime'),
    toggleSwitch: document.querySelector('.toggle-switch'),
    // Agenda Manager Elements
    popupAgendaManager: $('popup-agenda-manager'),
    calendarGrid: $('calendar-grid'),
    historyListContainer: $('history-list-container'),
    historySelectedDate: $('history-selected-date'),
    calendarCurrentMonth: $('calendar-current-month')
};

let currentCalendarDate = new Date();
let selectedHistoryDate = null;

// ===== 初始化 =====
function init() {
    // 1. 优先执行缩放逻辑，确保窗口适配
    updateAppScale();
    window.addEventListener('resize', updateAppScale);

    // 2. 其它初始化逻辑，添加错误捕获以防脚本加载失败导致中断
    try {
        loadData();
        loadSettings();
        loadHistory();
        generateMockData(); // Generates test data for Jan 28/29
        bindEvents();
        syncUI();
        applySettings();
        if (typeof Sortable !== 'undefined') {
            initSortable();
        } else {
            console.warn('SortableJS not loaded, drag features disabled');
        }
        initResizers();
    } catch (e) {
        console.error('Initialization error:', e);
    }
}

// ===== 可拖拽调整面板大小 =====
function initResizers() {
    // Resizer 1: Between modal-sidebar and modal-content
    const resizerSidebar = document.getElementById('resizer-sidebar');
    const modalSidebar = document.getElementById('modal-sidebar');
    const modalContent = document.getElementById('modal-content');

    if (resizerSidebar && modalSidebar && modalContent) {
        setupResizer(resizerSidebar, modalSidebar, 'width', 120, 300);
    }

    // Resizer 2: Between calendar-section and history-list-section
    const resizerCalendar = document.getElementById('resizer-calendar');
    const calendarSection = document.getElementById('calendar-section');
    const historyListSection = document.getElementById('history-list-section');

    if (resizerCalendar && calendarSection && historyListSection) {
        setupResizer(resizerCalendar, calendarSection, 'width', 180, 400);
    }
}

function setupResizer(resizer, targetPanel, dimension, minSize, maxSize) {
    let startPos = 0;
    let startSize = 0;
    let isResizing = false;

    function onMouseDown(e) {
        e.preventDefault();
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        startPos = e.clientX;
        startSize = targetPanel.offsetWidth;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!isResizing) return;

        const delta = e.clientX - startPos;
        let newSize = startSize + delta;

        // Clamp to min/max
        newSize = Math.max(minSize, Math.min(maxSize, newSize));

        targetPanel.style.width = newSize + 'px';
    }

    function onMouseUp() {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    resizer.addEventListener('mousedown', onMouseDown);
}

function generateMockData() {
    const dates = ['2026-01-28', '2026-01-29'];
    let changed = false;

    dates.forEach(date => {
        if (!historyData[date]) {
            historyData[date] = [];
            for (let i = 1; i <= 20; i++) {
                historyData[date].push({
                    title: `测试议程 ${i} - ${date}`,
                    plan: Math.floor(Math.random() * 30) + 15, // 15-45 mins
                    used: Math.floor(Math.random() * 30) + 15,
                    status: 'done',
                    timestamp: new Date(date).getTime() + i * 100000
                });
            }
            changed = true;
        }
    });

    if (changed) {
        saveHistory();
    }
}

// ===== 数据持久化 =====
function loadData() {
    const saved = localStorage.getItem('flex_v103_data');
    if (saved) {
        try {
            agendas = JSON.parse(saved);
        } catch (e) {
            agendas = [];
        }
    }
}

function saveData() {
    localStorage.setItem('flex_v103_data', JSON.stringify(agendas));
}

function loadHistory() {
    const saved = localStorage.getItem('flex_timer_history');
    if (saved) {
        try {
            historyData = JSON.parse(saved);
        } catch (e) {
            historyData = {};
        }
    }
}

function saveHistory() {
    localStorage.setItem('flex_timer_history', JSON.stringify(historyData));
}

function loadSettings() {
    const keys = ['timerColor', 'timerSize', 'uiColor', 'uiSize', 'opacity', 'warningSeconds', 'soundEnabled', 'alwaysOnTop'];
    keys.forEach(key => {
        const saved = localStorage.getItem(`flex_timer_${key}`);
        if (saved !== null) {
            if (key === 'soundEnabled' || key === 'alwaysOnTop') {
                settings[key] = saved === 'true';
            } else if (key.includes('Color')) {
                settings[key] = saved;
            } else {
                settings[key] = parseInt(saved, 10);
            }
        }
    });
}

function saveSettings() {
    Object.keys(settings).forEach(key => {
        localStorage.setItem(`flex_timer_${key}`, settings[key].toString());
    });
}

// ===== 历史记录逻辑 =====
function saveToHistory(agenda) {
    const today = new Date().toISOString().slice(0, 10);
    if (!historyData[today]) {
        historyData[today] = [];
    }

    // Check if duplicate (optional)

    const record = {
        title: agenda.title,
        plan: agenda.plan,
        used: Math.round(agenda.used / 60), // 保存分钟
        status: agenda.status,
        timestamp: Date.now()
    };

    historyData[today].push(record);
    saveHistory();
}

function getHistoryDatesInMonth(year, month) {
    const dates = [];
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    Object.keys(historyData).forEach(dateStr => {
        if (dateStr.startsWith(prefix) && historyData[dateStr].length > 0) {
            dates.push(dateStr);
        }
    });
    return dates;
}

// ===== 日历逻辑 =====
function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    if (elements.calendarCurrentMonth) {
        elements.calendarCurrentMonth.textContent = `${year}年 ${month + 1}月`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0(Sun) - 6(Sat)

    const grid = elements.calendarGrid;
    if (grid) {
        grid.innerHTML = '';

        // Header
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        weekDays.forEach(d => {
            const div = document.createElement('div');
            div.className = 'week-day';
            div.textContent = d;
            grid.appendChild(div);
        });

        // Empty cells for previous month
        for (let i = 0; i < startDayOfWeek; i++) {
            const div = document.createElement('div');
            div.className = 'date-cell other-month';
            div.textContent = '';
            grid.appendChild(div);
        }

        // Days
        const activeDates = getHistoryDatesInMonth(year, month);

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const localDateStr = `${y}-${m}-${day}`;

            const div = document.createElement('div');
            div.className = 'date-cell';
            div.textContent = i;
            div.dataset.date = localDateStr;

            if (activeDates.includes(localDateStr)) {
                div.classList.add('has-data');
            }

            if (localDateStr === selectedHistoryDate) {
                div.classList.add('selected');
            }

            div.addEventListener('click', () => {
                selectedHistoryDate = localDateStr;
                renderCalendar(currentCalendarDate); // Refresh to update selection highlight
                renderHistoryList(localDateStr);
            });

            grid.appendChild(div);
        }
    }
}

function renderHistoryList(dateStr) {
    const container = elements.historyListContainer;
    if (!container) return;

    container.innerHTML = '';

    if (!dateStr) {
        container.innerHTML = '<div class="empty-hint">请选择日期</div>';
        return;
    }

    // Format Date Label
    const date = new Date(dateStr);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    if (elements.historySelectedDate) {
        elements.historySelectedDate.textContent = `${date.getMonth() + 1}月${date.getDate()}日 (${weekDays[date.getDay()]})`;
    }

    const list = historyData[dateStr] || [];

    if (list.length === 0) {
        container.innerHTML = '<div class="empty-hint">该日期无会议记录</div>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';

        div.innerHTML = `
            <div class="h-info">
                <div class="h-title">${escapeHtml(item.title)}</div>
                <div class="h-duration">计划: ${item.plan}分 | 实际: ${item.used}分</div>
            </div>
            <div class="h-status">${item.status === 'done' ? '已完成' : '未完成'}</div>
        `;
        container.appendChild(div);
    });
}

// ===== UI 同步 =====
function syncUI() {
    renderAgendaList();
    updateTimerDisplay();
    updateButtonStates();
}

function renderAgendaList() {
    const listZone = elements.listZone;
    listZone.innerHTML = '';

    agendas.forEach((agenda, index) => {
        const card = document.createElement('div');
        card.className = 'card';

        // 状态类名
        if (agenda.status === 'done') {
            card.classList.add('done');
        } else if (index === currentIndex) {
            card.classList.add(isRunning ? 'active' : 'selected');
        }
        card.dataset.index = index;

        // 状态图标
        let statusIcon = '';
        if (agenda.status === 'done') {
            statusIcon = `
                <div class="status-icon done">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="#4CAF50"/>
                        <path d="M7 12L10 15L17 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>`;
        } else if (index === currentIndex && isRunning) {
            statusIcon = `
                <div class="status-icon active">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <circle cx="12" cy="12" r="12" fill="#0078d4" opacity="0.2"/>
                         <circle cx="12" cy="12" r="6" fill="#0078d4">
                            <animate attributeName="r" values="6;8;6" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
                         </circle>
                    </svg>
                </div>`;
        } else {
            // Pending - Orange Clock
            statusIcon = `
                <div class="status-icon pending">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <circle cx="12" cy="12" r="12" fill="#F5A623"/>
                         <path d="M12 7V12L15 15" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>`;
        }

        card.innerHTML = `
            <span class="card-drag-handle">☰</span>
            <div class="card-content">
                <div class="card-title">${escapeHtml(agenda.title)}</div>
                <div class="card-duration">计划: ${agenda.plan}分钟</div>
            </div>
            ${statusIcon}
            <button class="card-delete" data-index="${index}">×</button>
        `;

        listZone.appendChild(card);
    });
}

function updateTimerDisplay() {
    if (agendas.length === 0) {
        elements.timerDisplay.textContent = '00:00';
        elements.currentTitle.textContent = '点击"议程"添加第一个议题';
        elements.timerStatus.textContent = '';
        elements.timerDisplay.classList.remove('warning', 'overtime');
        return;
    }

    const current = agendas[currentIndex];
    if (!current) return;

    elements.currentTitle.textContent = current.title;

    if (current.rem >= 0) {
        elements.timerDisplay.textContent = formatTime(current.rem);
        elements.timerDisplay.classList.remove('overtime');

        if (current.rem <= settings.warningSeconds && current.rem > 0) {
            elements.timerDisplay.classList.add('warning');
        } else {
            elements.timerDisplay.classList.remove('warning');
        }
    } else {
        elements.timerDisplay.textContent = '-' + formatTime(Math.abs(current.rem));
        elements.timerDisplay.classList.add('overtime');
        elements.timerDisplay.classList.remove('warning');
    }

    // 状态提示
    if (!isRunning) {
        elements.timerStatus.textContent = isPaused ? '已暂停' : '准备就绪';
    } else {
        if (current.rem < 0) {
            elements.timerStatus.textContent = '⚠️ 超时中...';
        } else {
            elements.timerStatus.textContent = '进行中';
        }
    }
}

function updateButtonStates() {
    const current = agendas[currentIndex];
    if (current && current.status === 'done') {
        elements.btnStart.textContent = '已完成';
        elements.btnStart.disabled = true;
        elements.btnStart.style.opacity = '0.5';
        elements.btnStart.style.cursor = 'not-allowed';
    } else {
        elements.btnStart.disabled = false;
        elements.btnStart.style.opacity = '1';
        elements.btnStart.style.cursor = 'pointer';
        if (!isRunning) {
            elements.btnStart.textContent = isPaused ? '继续' : '开始';
        } else {
            elements.btnStart.textContent = '暂停';
        }
    }

    if (elements.toggleSwitch) {
        elements.toggleSwitch.classList.toggle('on', overtimeEnabled);
    }
}

function applySettings() {
    // 倒计时样式
    document.documentElement.style.setProperty('--timer-color', settings.timerColor);
    document.documentElement.style.setProperty('--timer-size', settings.timerSize + 'px');
    document.documentElement.style.setProperty('--ui-size', settings.uiSize + 'px');

    if (elements.timerDisplay) {
        elements.timerDisplay.style.color = settings.timerColor;
        elements.timerDisplay.style.fontSize = settings.timerSize + 'px';
    }

    if (elements.currentTitle) {
        elements.currentTitle.style.color = settings.timerColor;
        elements.currentTitle.style.fontSize = Math.max(16, settings.timerSize * 0.45) + 'px';
    }

    // UI样式
    document.documentElement.style.setProperty('--ui-color', settings.uiColor);
    document.documentElement.style.setProperty('--text-primary', settings.uiColor); // Apply globally
    document.documentElement.style.setProperty('--ui-size', settings.uiSize + 'px');

    // 更新设置面板的值
    if ($('input-timer-color')) $('input-timer-color').value = settings.timerColor;
    if ($('input-timer-size')) $('input-timer-size').value = settings.timerSize;
    if ($('input-ui-color')) $('input-ui-color').value = settings.uiColor;
    if ($('input-ui-size')) $('input-ui-size').value = settings.uiSize;
    if ($('ui-size-value')) $('ui-size-value').textContent = settings.uiSize + 'px';
    if ($('input-opacity')) $('input-opacity').value = settings.opacity;
    if ($('opacity-value')) $('opacity-value').textContent = settings.opacity + '%';
    if ($('input-warning-seconds')) $('input-warning-seconds').value = settings.warningSeconds;
    if ($('input-sound-enabled')) $('input-sound-enabled').checked = settings.soundEnabled;
    if ($('input-always-on-top')) $('input-always-on-top').checked = settings.alwaysOnTop;

    // 更新预览
    updateAppearancePreview();

    // 更新滑动条音轨高亮
    updateSliderTrackHighlight($('input-timer-size'));
    updateSliderTrackHighlight($('input-ui-size'));
    updateSliderTrackHighlight($('input-opacity'));

    // Electron 透明度 (不再使用系统级透明度以保持内容清晰)
    if (window.electronAPI) {
        // 更新 CSS 变量控制背景透明度
        document.documentElement.style.setProperty('--bg-opacity', settings.opacity / 100);
        // 系统透明度保持 1.0，确保文字和按钮清晰
        window.electronAPI.setOpacity(1.0);
        window.electronAPI.setAlwaysOnTop(settings.alwaysOnTop);
    }
}

function updateSliderTrackHighlight(el) {
    if (!el) return;
    const min = el.min || 0;
    const max = el.max || 100;
    const val = ((el.value - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, var(--primary-blue) ${val}%, rgba(255, 255, 255, 0.1) ${val}%)`;
}

function updateAppearancePreview() {
    // 倒计时颜色预览
    const timerColorPreview = $('timer-color-preview');
    if (timerColorPreview) {
        timerColorPreview.style.color = settings.timerColor;
    }

    // 倒计时大小预览
    const timerSizePreview = $('timer-size-preview');
    if (timerSizePreview) {
        timerSizePreview.style.color = settings.timerColor;
        const previewSize = Math.min(settings.timerSize, 80);
        timerSizePreview.style.fontSize = previewSize + 'px';
    }

    // 同步议程标题预览 (如果存在预览元素，或者直接在 preview 区域模拟)
    const currentTitlePreview = $('current-agenda-title');
    if (currentTitlePreview) {
        currentTitlePreview.style.color = settings.timerColor;
        // 预览时也保持比例，但受限于容器
        const titlePreviewSize = Math.max(12, Math.min(settings.timerSize * 0.45, 30));
        currentTitlePreview.style.fontSize = titlePreviewSize + 'px';
    }

    // 倒计时渐变条
    const timerGradient = $('timer-color-gradient');
    if (timerGradient) {
        const baseColor = settings.timerColor;
        timerGradient.style.background = `linear-gradient(90deg, ${baseColor} 0%, ${lightenColor(baseColor, 30)} 50%, ${lightenColor(baseColor, 60)} 100%)`;
    }

    // UI颜色预览
    const uiColorPreview = $('ui-color-preview');
    if (uiColorPreview) {
        uiColorPreview.style.color = settings.uiColor;
    }

    // UI渐变条
    const uiGradient = $('ui-color-gradient');
    if (uiGradient) {
        const baseColor = settings.uiColor;
        uiGradient.style.background = `linear-gradient(90deg, ${baseColor} 0%, ${lightenColor(baseColor, 30)} 50%, ${lightenColor(baseColor, 60)} 100%)`;
    }
}

function lightenColor(color, percent) {
    // 简单的颜色变亮函数
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ===== 计时器逻辑 =====
function tick() {
    if (!isRunning || agendas.length === 0) return;

    const current = agendas[currentIndex];
    if (!current) return;

    current.rem--;
    current.used++;

    if (current.rem < 0) {
        current.overtime++;
    }

    // 超时且未开启延长 -> 自动跳过
    if (current.rem < 0 && !overtimeEnabled) {
        skipToNext();
        return;
    }

    // 预警声音
    if (current.rem === settings.warningSeconds && settings.soundEnabled) {
        playBeep();
    }

    // 结束声音
    if (current.rem === 0 && settings.soundEnabled) {
        playBeep(2);
    }

    saveData();
    syncUI();
}

function handleTimer() {
    if (agendas.length === 0) {
        showPopup('add'); // 会重定向到 manager
        return;
    }

    if (isRunning) {
        // 暂停
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        isPaused = true;
        syncUI();
    } else {
        // 开始 / 继续
        const current = agendas[currentIndex];
        if (current && current.status === 'done') {
            return; // 已完成的议程不能重新开始
        }

        if (!isPaused) {
            // 首次开始，显示倒计时动画
            showCountdownAnimation(() => {
                startTimer();
            });
        } else {
            // 从暂停继续
            startTimer();
        }
    }
}

function startTimer() {
    isRunning = true;
    isPaused = false;
    timerInterval = setInterval(tick, 1000);
    syncUI();
}

function showCountdownAnimation(callback) {
    const overlay = document.createElement('div');
    overlay.id = 'countdown-overlay';

    overlay.innerHTML = `
        <div id="countdown-text">3</div>
        <div id="countdown-label">准备开始</div>
    `;

    const scaler = $('app-scaler');
    if (scaler) {
        scaler.appendChild(overlay);
    } else {
        document.body.appendChild(overlay);
    }

    const countdownText = $('countdown-text');
    let count = 3;

    // Initial pulse
    countdownText.classList.add('countdown-pulse');

    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
            countdownText.classList.remove('countdown-pulse');
            void countdownText.offsetWidth; // Trigger reflow
            countdownText.classList.add('countdown-pulse');
        } else {
            clearInterval(countInterval);
            overlay.style.animation = 'fadeOut 0.4s ease-in forwards';
            setTimeout(() => {
                overlay.remove();
                callback();
            }, 400);
        }
    }, 1000);
}

function skipToNext() {
    if (agendas.length === 0) return;

    // 停止当前计时
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;

    const current = agendas[currentIndex];
    if (current && current.status !== 'done') {
        current.status = 'done';
        saveToHistory(current);
    }

    currentIndex++;

    if (currentIndex >= agendas.length) {
        // 全部完成
        currentIndex = 0; // 重置到第一个，但保持已完成状态
        elements.timerStatus.textContent = '✅ 全部完成';
        isPaused = false;
        saveData();
        syncUI();
    } else {
        // 准备下一个议程，显示 3s 倒计时
        saveData();
        syncUI();

        showCountdownAnimation(() => {
            startTimer();
        });
    }
}

function resetAll() {
    if (!confirm('确定要重置所有议程吗？')) return;

    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    isPaused = false;
    currentIndex = 0;

    agendas.forEach(a => {
        a.rem = a.plan * 60;
        a.used = 0;
        a.overtime = 0;
        a.status = 'ready';
    });

    saveData();
    syncUI();
}

// ===== 议程管理 =====
function archiveDailyAgenda() {
    if (agendas.length === 0) {
        alert('没有可归档的议程');
        return;
    }

    // 检查是否有未完成的议程
    const unfinishedIndex = agendas.findIndex(a => a.status !== 'done');
    if (unfinishedIndex !== -1) {
        alert('当日还有未完成的议程，无法归档');
        return;
    }

    if (!confirm('确定要归档当日所有议程吗？\n(这将会清空当前列表，所有已完成的议程已自动保存至历史记录)')) {
        return;
    }

    // 执行归档 (清空当前列表)
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    isPaused = false;
    currentIndex = 0;
    agendas = [];

    saveData();
    syncUI();

    // 可选: 显示成功提示或简单的动画反馈
    // alert('归档成功');
}

// ===== 议程管理 =====
function addAgenda(title, plan) {
    agendas.push({
        title: title,
        rem: plan * 60,
        plan: plan,
        status: 'ready',
        used: 0,
        overtime: 0
    });
    saveData();
    syncUI();
}

function deleteAgenda(index) {
    if (index === currentIndex && isRunning) {
        alert('无法删除正在进行的议程');
        return;
    }

    agendas.splice(index, 1);

    if (currentIndex >= agendas.length) {
        currentIndex = Math.max(0, agendas.length - 1);
    }

    saveData();
    syncUI();
}

// ===== 弹窗控制 =====
function showPopup(type) {
    elements.popupOverlay.classList.remove('hidden');
    document.querySelectorAll('.popup-card').forEach(p => p.classList.add('hidden'));

    // 重定向 'add' 到 'agenda-manager'
    if (type === 'add') {
        type = 'agenda-manager';
        switchTab('new');
    }

    const popup = $(`popup-${type}`);
    if (popup) {
        popup.classList.remove('hidden');
    }

    if (type === 'agenda-manager') {
        // Focus title input if visible
        const titleInput = $('input-title');
        if (titleInput && titleInput.offsetParent !== null) {
            setTimeout(() => titleInput.focus(), 100);
        }

        // Init Calendar
        if (!selectedHistoryDate) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            selectedHistoryDate = `${y}-${m}-${d}`;
        }
        renderCalendar(currentCalendarDate);
        renderHistoryList(selectedHistoryDate);
    }
}

function hidePopup() {
    elements.popupOverlay.classList.add('hidden');
    document.querySelectorAll('.popup-card').forEach(p => p.classList.add('hidden'));
}

function switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.modal-nav-item').forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update sections
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.remove('active');
        // Small delay to allow display:none to apply before display:block for animation
        section.classList.add('hidden');
    });

    const activeSection = $(`section-${tabName}-agenda`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('active');
    }
}

// ===== 导出功能 =====
function exportCSV() {
    if (agendas.length === 0) {
        alert('没有可导出的议程数据');
        return;
    }

    let csv = '\uFEFF议题名称,计划时长(分钟),实际用时(秒),超时(秒),状态\n';
    agendas.forEach(a => {
        csv += `"${a.title}",${a.plan},${a.used},${a.overtime},${a.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FlexTimer_复盘_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ===== 事件绑定 =====
function bindEvents() {
    // 窗口控制
    if ($('btn-close')) {
        $('btn-close').addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.close();
            } else {
                window.close();
            }
        });
    }

    // 顶部按钮
    if ($('btn-review')) $('btn-review').addEventListener('click', exportCSV);
    if ($('btn-reset')) $('btn-reset').addEventListener('click', resetAll);
    if ($('btn-manage')) $('btn-manage').addEventListener('click', () => showPopup('agenda-manager'));
    if ($('btn-list')) $('btn-list').addEventListener('click', toggleSidebar);
    if ($('btn-appearance')) $('btn-appearance').addEventListener('click', () => showPopup('appearance'));
    if ($('btn-alert')) $('btn-alert').addEventListener('click', () => showPopup('alert'));
    if ($('btn-settings')) $('btn-settings').addEventListener('click', () => showPopup('settings'));

    // 控制栏
    if (elements.btnStart) elements.btnStart.addEventListener('click', handleTimer);
    if (elements.btnSkip) elements.btnSkip.addEventListener('click', skipToNext);
    if (elements.btnOvertime) elements.btnOvertime.addEventListener('click', () => {
        overtimeEnabled = !overtimeEnabled;
        syncUI();
    });

    if ($('btn-archive-agenda')) $('btn-archive-agenda').addEventListener('click', archiveDailyAgenda);

    // 侧边栏
    if ($('btn-sidebar-close')) $('btn-sidebar-close').addEventListener('click', toggleSidebar);
    if ($('btn-add-agenda')) $('btn-add-agenda').addEventListener('click', () => showPopup('add'));

    // 议程管理弹窗事件
    const btnCloseManager = $('btn-close-manager');
    if (btnCloseManager) btnCloseManager.addEventListener('click', hidePopup);

    // Tab切换
    document.querySelectorAll('.modal-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });

    // 日历导航
    const btnPrevMonth = $('btn-prev-month');
    if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(currentCalendarDate);
    });

    const btnNextMonth = $('btn-next-month');
    if (btnNextMonth) btnNextMonth.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(currentCalendarDate);
    });

    // 添加议程
    if ($('btn-confirm-add')) $('btn-confirm-add').addEventListener('click', confirmAddAgenda);
    if ($('input-title')) $('input-title').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddAgenda();
    });
    if ($('input-duration')) $('input-duration').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddAgenda();
    });

    // 外观设置
    // 倒计时设置
    if ($('input-timer-color')) $('input-timer-color').addEventListener('input', (e) => {
        settings.timerColor = e.target.value;
        updateAppearancePreview();
    });
    // 字体颜色渐变条随动 (示例，可根据需要细化)
    if ($('input-timer-size')) $('input-timer-size').addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        // Snapping logic
        const marks = [40, 80, 120, 160, 200, 300, 400];
        const snapThreshold = 10;
        for (const mark of marks) {
            if (Math.abs(val - mark) < snapThreshold) {
                val = mark;
                e.target.value = val;
                break;
            }
        }
        settings.timerSize = val;
        applySettings();
    });

    // UI设置
    if ($('input-ui-color')) $('input-ui-color').addEventListener('input', (e) => {
        settings.uiColor = e.target.value;
        updateAppearancePreview();
    });
    if ($('input-ui-size')) $('input-ui-size').addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        // Snapping logic
        const marks = [12, 14, 16, 18, 20, 24];
        const snapThreshold = 1;
        for (const mark of marks) {
            if (Math.abs(val - mark) < snapThreshold) {
                val = mark;
                e.target.value = val;
                break;
            }
        }
        settings.uiSize = val;
        applySettings();
    });

    if ($('input-opacity')) $('input-opacity').addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        // Snapping logic
        const marks = [20, 40, 60, 80, 100];
        const snapThreshold = 3;
        for (const mark of marks) {
            if (Math.abs(val - mark) < snapThreshold) {
                val = mark;
                e.target.value = val;
                break;
            }
        }
        settings.opacity = val;
        applySettings();
        if ($('opacity-value')) $('opacity-value').textContent = settings.opacity + '%';
    });
    if ($('btn-save-appearance')) $('btn-save-appearance').addEventListener('click', () => {
        applySettings();
        saveSettings();
        hidePopup();
    });
    if ($('btn-cancel-appearance')) $('btn-cancel-appearance').addEventListener('click', hidePopup);

    // 提醒设置
    if ($('input-warning-seconds')) $('input-warning-seconds').addEventListener('change', (e) => {
        settings.warningSeconds = parseInt(e.target.value, 10) || 10;
        saveSettings();
    });
    if ($('input-sound-enabled')) $('input-sound-enabled').addEventListener('change', (e) => {
        settings.soundEnabled = e.target.checked;
        saveSettings();
    });
    if ($('btn-cancel-alert')) $('btn-cancel-alert').addEventListener('click', hidePopup);
    if ($('btn-save-alert')) $('btn-save-alert').addEventListener('click', () => {
        settings.warningSeconds = parseInt($('input-warning-seconds').value, 10) || 10;
        settings.soundEnabled = $('input-sound-enabled').checked;
        saveSettings();
        hidePopup();
    });

    // 通用设置
    if ($('input-always-on-top')) $('input-always-on-top').addEventListener('change', (e) => {
        settings.alwaysOnTop = e.target.checked;
        applySettings();
        saveSettings();
    });
    if ($('btn-close-settings')) $('btn-close-settings').addEventListener('click', hidePopup);

    // 弹窗遮罩点击关闭
    elements.popupOverlay.addEventListener('click', (e) => {
        if (e.target === elements.popupOverlay) {
            hidePopup();
        }
    });

    // 议程列表删除按钮和卡片点击
    elements.listZone.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteAgenda(index);
        } else {
            // 点击卡片切换到该议程（仅限未运行时）
            const card = e.target.closest('.card');
            if (card && !isRunning) {
                const index = parseInt(card.dataset.index, 10);
                if (!isNaN(index) && index !== currentIndex) {
                    currentIndex = index;
                    syncUI();
                }
            }
        }
    });
}

function confirmAddAgenda() {
    const title = $('input-title').value.trim();
    const duration = parseInt($('input-duration').value, 10);

    if (!title) {
        alert('请输入议题名称');
        return;
    }
    if (!duration || duration < 1) {
        alert('请输入有效的时长');
        return;
    }

    // 检查是否有重复名称
    const isDuplicate = agendas.some(agenda => agenda.title === title);
    if (isDuplicate) {
        alert('该议程已存在');
        return;
    }

    addAgenda(title, duration);
    $('input-title').value = '';
    $('input-duration').value = '5';
    // 隐藏弹窗
    hidePopup();
}

function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
}

// ===== 拖拽排序 =====
function initSortable() {
    new Sortable(elements.listZone, {
        animation: 150,
        handle: '.card-drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.done', // 已完成的议程不可拖拽
        onMove: (evt) => {
            // 禁止将卡片移动到已完成议程的位置之前
            const targetIndex = parseInt(evt.related.dataset.index, 10);
            if (agendas[targetIndex] && agendas[targetIndex].status === 'done') {
                return false;
            }
        },
        onEnd: (evt) => {
            const item = agendas.splice(evt.oldIndex, 1)[0];
            agendas.splice(evt.newIndex, 0, item);

            // 更新当前索引
            if (evt.oldIndex === currentIndex) {
                currentIndex = evt.newIndex;
            } else if (evt.oldIndex < currentIndex && evt.newIndex >= currentIndex) {
                currentIndex--;
            } else if (evt.oldIndex > currentIndex && evt.newIndex <= currentIndex) {
                currentIndex++;
            }

            saveData();
            syncUI();
        }
    });
}

// ===== 工具函数 =====
function formatTime(seconds) {
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60).toString().padStart(2, '0');
    const s = (absSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function playBeep(count = 1) {
    // 简单的音频上下文蜂鸣
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            }, i * 600);
        }
    } catch (e) {
        console.error('Audio play failed', e);
    }
}

function updateAppScale() {
    const scaler = $('app-scaler');
    if (!scaler) return;

    const baseWidth = 800;
    const baseHeight = 500;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // 计算缩放比例
    const scale = Math.min(winW / baseWidth, winH / baseHeight);

    // 计算居中偏移量 (因为 transform-origin 是 0 0)
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    const offsetX = (winW - scaledWidth) / 2;
    const offsetY = (winH - scaledHeight) / 2;

    // 应用变换
    scaler.style.transform = `scale(${scale})`;
    scaler.style.left = `${offsetX}px`;
    scaler.style.top = `${offsetY}px`;
}

// 启动
window.addEventListener('DOMContentLoaded', init);
