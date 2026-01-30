// ===== 数据模型 =====
let agendas = [];
let currentIndex = 0;
let isRunning = false;
let isPaused = false;
let timerInterval = null;
let overtimeEnabled = true;
let countdownPhase = 0; // 0: 无, 3/2/1: 倒数

// ===== 用户设置 =====
let settings = {
    fontColor: '#00ff00',
    fontSize: 80,
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
    toggleSwitch: document.querySelector('.toggle-switch')
};

// ===== 初始化 =====
function init() {
    loadData();
    loadSettings();
    bindEvents();
    syncUI();
    applySettings();
    initSortable();
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

function loadSettings() {
    const keys = ['fontColor', 'fontSize', 'opacity', 'warningSeconds', 'soundEnabled', 'alwaysOnTop'];
    keys.forEach(key => {
        const saved = localStorage.getItem(`flex_timer_${key}`);
        if (saved !== null) {
            if (key === 'soundEnabled' || key === 'alwaysOnTop') {
                settings[key] = saved === 'true';
            } else if (key === 'fontColor') {
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
        if (index === currentIndex && isRunning) card.classList.add('active');
        if (agenda.status === 'done') card.classList.add('done');
        card.dataset.index = index;

        card.innerHTML = `
            <span class="card-drag-handle">☰</span>
            <div class="card-content">
                <div class="card-title">${escapeHtml(agenda.title)}</div>
                <div class="card-duration">${formatTime(agenda.rem)} / ${agenda.plan}分钟</div>
            </div>
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
    if (!isRunning) {
        elements.btnStart.textContent = isPaused ? '继续' : '开始';
    } else {
        elements.btnStart.textContent = '暂停';
    }

    elements.toggleSwitch.classList.toggle('on', overtimeEnabled);
}

function applySettings() {
    document.documentElement.style.setProperty('--timer-color', settings.fontColor);
    document.documentElement.style.setProperty('--timer-size', settings.fontSize + 'px');

    // 更新设置面板的值
    $('input-font-color').value = settings.fontColor;
    $('input-font-size').value = settings.fontSize;
    $('font-size-value').textContent = settings.fontSize;
    $('input-opacity').value = settings.opacity;
    $('opacity-value').textContent = settings.opacity;
    $('input-warning-seconds').value = settings.warningSeconds;
    $('input-sound-enabled').checked = settings.soundEnabled;
    $('input-always-on-top').checked = settings.alwaysOnTop;

    // Electron 透明度
    if (window.electronAPI) {
        window.electronAPI.setOpacity(settings.opacity / 100);
        window.electronAPI.setAlwaysOnTop(settings.alwaysOnTop);
    }
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
        showPopup('add');
        return;
    }

    if (isRunning) {
        // 暂停
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        isPaused = true;
    } else {
        // 开始 / 继续
        isRunning = true;
        isPaused = false;
        timerInterval = setInterval(tick, 1000);
    }

    syncUI();
}

function skipToNext() {
    if (agendas.length === 0) return;

    const current = agendas[currentIndex];
    if (current) {
        current.status = 'done';
    }

    currentIndex++;

    if (currentIndex >= agendas.length) {
        // 全部完成
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        isPaused = false;
        currentIndex = 0;
        elements.timerStatus.textContent = '✅ 全部完成';
    }

    saveData();
    syncUI();
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
    $(`popup-${type}`).classList.remove('hidden');

    if (type === 'add') {
        $('input-title').focus();
    }
}

function hidePopup() {
    elements.popupOverlay.classList.add('hidden');
    document.querySelectorAll('.popup-card').forEach(p => p.classList.add('hidden'));
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
    $('btn-close').addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.close();
        } else {
            window.close();
        }
    });

    // 顶部按钮
    $('btn-review').addEventListener('click', exportCSV);
    $('btn-reset').addEventListener('click', resetAll);
    $('btn-agenda').addEventListener('click', toggleSidebar);
    $('btn-appearance').addEventListener('click', () => showPopup('appearance'));
    $('btn-alert').addEventListener('click', () => showPopup('alert'));
    $('btn-settings').addEventListener('click', () => showPopup('settings'));

    // 控制栏
    elements.btnStart.addEventListener('click', handleTimer);
    elements.btnSkip.addEventListener('click', skipToNext);
    elements.btnOvertime.addEventListener('click', () => {
        overtimeEnabled = !overtimeEnabled;
        syncUI();
    });

    // 侧边栏
    $('btn-sidebar-close').addEventListener('click', toggleSidebar);
    $('btn-add-agenda').addEventListener('click', () => showPopup('add'));

    // 添加议程弹窗
    $('btn-cancel-add').addEventListener('click', hidePopup);
    $('btn-confirm-add').addEventListener('click', confirmAddAgenda);
    $('input-title').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddAgenda();
    });
    $('input-duration').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAddAgenda();
    });

    // 外观设置
    $('input-font-color').addEventListener('input', (e) => {
        settings.fontColor = e.target.value;
        applySettings();
        saveSettings();
    });
    $('input-font-size').addEventListener('input', (e) => {
        settings.fontSize = parseInt(e.target.value, 10);
        $('font-size-value').textContent = settings.fontSize;
        applySettings();
        saveSettings();
    });
    $('input-opacity').addEventListener('input', (e) => {
        settings.opacity = parseInt(e.target.value, 10);
        $('opacity-value').textContent = settings.opacity;
        applySettings();
        saveSettings();
    });
    $('btn-close-appearance').addEventListener('click', hidePopup);

    // 提醒设置
    $('input-warning-seconds').addEventListener('change', (e) => {
        settings.warningSeconds = parseInt(e.target.value, 10) || 10;
        saveSettings();
    });
    $('input-sound-enabled').addEventListener('change', (e) => {
        settings.soundEnabled = e.target.checked;
        saveSettings();
    });
    $('btn-close-alert').addEventListener('click', hidePopup);

    // 通用设置
    $('input-always-on-top').addEventListener('change', (e) => {
        settings.alwaysOnTop = e.target.checked;
        applySettings();
        saveSettings();
    });
    $('btn-close-settings').addEventListener('click', hidePopup);

    // 弹窗遮罩点击关闭
    elements.popupOverlay.addEventListener('click', (e) => {
        if (e.target === elements.popupOverlay) {
            hidePopup();
        }
    });

    // 议程列表删除按钮
    elements.listZone.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-delete')) {
            const index = parseInt(e.target.dataset.index, 10);
            deleteAgenda(index);
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

    addAgenda(title, duration);
    $('input-title').value = '';
    $('input-duration').value = '5';
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
    const m = Math.floor(absSeconds / 60);
    const s = absSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function playBeep(times = 1) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    for (let i = 0; i < times; i++) {
        setTimeout(() => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.15);
        }, i * 200);
    }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);
