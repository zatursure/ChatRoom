// 日志级别枚举
const LogLevel = {
    ERROR: 0,   // 错误
    WARN: 1,    // 警告
    INFO: 2,    // 重要信息
    DEBUG: 3    // 调试信息
};

const currentLogLevel = LogLevel.INFO;

// 优化后的日志函数
function chatLog(level, type, message, data = null) {
    if (level > currentLogLevel) return;

    const timestamp = new Date().toLocaleString('zh-CN');
    let style;
    let prefix;
    
    switch(level) {
        case LogLevel.ERROR:
            style = 'color: #ff5252; font-weight: bold;';
            prefix = 'ERROR';
            break;
        case LogLevel.WARN:
            style = 'color: #fb8c00; font-weight: bold;';
            prefix = 'WARN';
            break;
        case LogLevel.INFO:
            style = 'color: #2196F3; font-weight: bold;';
            prefix = 'INFO';
            break;
        case LogLevel.DEBUG:
            style = 'color: #757575; font-weight: bold;';
            prefix = 'DEBUG';
            break;
    }

    console.log(`%c[${timestamp}] [${prefix}] [${type}] ${message}`, style);
    if (data && level <= LogLevel.INFO) {
        console.log('%c数据:', 'color: #4CAF50; font-weight: bold;', data);
    }
}

const sessionId = sessionStorage.getItem('sessionId');
if (!sessionId) {
    chatLog(LogLevel.ERROR, '会话', '未找到会话ID');
    window.location.href = '/?error=no_session';
}

const socket = io({
    auth: {
        sessionId: sessionId
    }
});

const username = sessionStorage.getItem('username');
if (!username) {
    chatLog(LogLevel.ERROR, '会话', '未找到用户名');
    window.location.href = '/?error=no_username';
}

// UI元素
const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const userList = document.getElementById('userList');
const themeToggle = document.getElementById('themeToggle');
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const typingIndicator = document.getElementById('typingIndicator');
const userCount = document.getElementById('userCount');

// 主题切换功能
let isDarkTheme = localStorage.getItem('theme') === 'dark';

// 初始化主题
if (isDarkTheme) {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '☀️';
}

// 主题切换事件处理 - 只在本地生效
themeToggle.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('dark-theme');
    themeToggle.textContent = isDarkTheme ? '☀️' : '🌙';
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    
    // 更新表情选择器主题（如果已经创建）
    if (picker) {
        picker.updateTheme(isDarkTheme ? 'dark' : 'light');
    }
});

// 表情选择器初始化
let picker = null;

function renderEmoji(emoji) {
    input.value += emoji.native;
    input.focus();
    emojiPicker.style.display = 'none';
}

emojiButton.addEventListener('click', () => {
    if (!picker) {
        picker = new EmojiMart.Picker({
            data: emojiData,
            onEmojiSelect: renderEmoji,
            locale: 'zh',
            theme: isDarkTheme ? 'dark' : 'light',
            autoFocus: true,
            showPreview: false,
            showSkinTones: false,
            style: {
                width: '300px'
            }
        });
        emojiPicker.appendChild(picker);
    }
    
    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
        emojiPicker.style.display = 'block';
    } else {
        emojiPicker.style.display = 'none';
    }
});

// 点击其他地方关闭表情选择器
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
        emojiPicker.style.display = 'none';
    }
});

// Socket事件处理
socket.on('connect', () => {
    chatLog(LogLevel.INFO, '连接', '已连接到服务器');
    document.getElementById('status').className = 'connected';
    document.getElementById('status').textContent = '已连接';
    enableInterface();
});

socket.on('connect_error', (error) => {
    chatLog(LogLevel.ERROR, '连接', error.message);
    if (error.message === '未授权') {
        sessionStorage.clear();
        window.location.href = '/?error=auth_failed';
    }
    disableInterface();
});

socket.on('disconnect', () => {
    chatLog(LogLevel.WARN, '连接', '与服务器断开连接');
    document.getElementById('status').className = 'disconnected';
    document.getElementById('status').textContent = '已断开';
    disableInterface();
    showError('连接断开，正在重试...');
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (msg) {
        socket.emit('chat message', msg);
        input.value = '';
        socket.emit('stop typing', username);
        typingTimeout = null;
    }
});

function enableInterface() {
    chatLog(LogLevel.DEBUG, '界面', '启用聊天界面');
    form.classList.remove('disabled');
    input.disabled = false;
    input.placeholder = '输入消息...';
}

function disableInterface() {
    chatLog(LogLevel.DEBUG, '界面', '禁用聊天界面');
    form.classList.add('disabled');
    input.disabled = true;
    input.placeholder = '连接中...';
}

function showError(message) {
    chatLog(LogLevel.ERROR, '错误', message);
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}

// 消息处理
socket.on('chat message', (data) => {
    const li = document.createElement('li');
    li.className = data.username === username ? 'message-self' : 'message-others';
    
    const time = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    li.innerHTML = `
        <strong>${data.username}</strong>
        <div class="message-content">${data.message}</div>
        <div class="message-time">${time}</div>
    `;
    
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
});

// 用户列表更新
socket.on('userList', (users) => {
    userList.innerHTML = '';
    userCount.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user === username ? `${user} (你)` : user;
        if (user === username) {
            li.classList.add('current-user');
        }
        userList.appendChild(li);
    });
});

// 添加用户加入系统消息
socket.on('userJoined', (user) => {
    if (user !== username) {
        const li = document.createElement('li');
        li.className = 'system-message';
        li.textContent = `${user} 加入了聊天室`;
        messages.appendChild(li);
        messages.scrollTop = messages.scrollHeight;
    }
});

// 添加用户离开系统消息
socket.on('userLeft', (user) => {
    const li = document.createElement('li');
    li.className = 'system-message';
    li.textContent = `${user} 离开了聊天室`;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
});

// 添加打字指示器功能
let typingTimeout;
input.addEventListener('input', () => {
    if (!typingTimeout) {
        socket.emit('typing', username);
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing', username);
        typingTimeout = null;
    }, 1000);
});

// 显示用户正在输入信息
socket.on('typing', (user) => {
    if (user !== username) {
        typingIndicator.textContent = `${user} 正在输入...`;
        typingIndicator.classList.add('active');
    }
});

socket.on('stop typing', (user) => {
    if (user !== username) {
        typingIndicator.classList.remove('active');
    }
});

socket.on('userJoined', (user) => {
    chatLog(LogLevel.INFO, '用户加入', user);
});

socket.on('userLeft', (user) => {
    chatLog(LogLevel.INFO, '用户离开', user);
});

socket.on('muted', () => {
    chatLog(LogLevel.WARN, '禁言', '您已被禁言');
    showError('您已被禁言，无法发送消息');
});

socket.on('kicked', () => {
    chatLog(LogLevel.ERROR, '踢出', '您已被管理员踢出聊天室');
    sessionStorage.clear();
    window.location.href = '/?error=kicked';
});
