// 日志级别枚举
const LogLevel = {
    ERROR: 0,   // 错误
    WARN: 1,    // 警告
    INFO: 2,    // 重要信息
    DEBUG: 3    // 调试信息
};

const currentLogLevel = LogLevel.INFO;

// 优化后的日志函数
function loginLog(level, type, message, data = null) {
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

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

// 检查URL中的错误参数
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('error')) {
    const errorType = urlParams.get('error');
    loginLog(LogLevel.ERROR, 'URL错误', `检测到错误参数: ${errorType}`);
    switch(errorType) {
        case 'no_session':
            showError('会话已过期，请重新登录');
            break;
        case 'invalid_session':
            showError('无效的会话，请重新登录');
            break;
        case 'auth_failed':
            showError('认证失败，请重新登录');
            break;
        case 'kicked':
            showError('您已被管理员踢出聊天室');
            break;
        default:
            showError('登录失败，请重试');
    }
    sessionStorage.clear();
}

function showError(message) {
    loginLog(LogLevel.ERROR, '错误显示', message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    loginLog(LogLevel.INFO, '登录尝试', `用户名: ${username}`);

    if (!username) {
        loginLog(LogLevel.WARN, '验证失败', '用户名为空');
        showError('用户名不能为空');
        return;
    }

    try {
        loginLog(LogLevel.DEBUG, '发送请求', '正在发送登录请求');
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        
        if (response.ok) {
            loginLog(LogLevel.INFO, '登录成功', '用户登录成功', data);
            sessionStorage.setItem('sessionId', data.sessionId);
            sessionStorage.setItem('username', data.username);
            window.location.href = `/chat?sessionId=${data.sessionId}`;
        } else {
            loginLog(LogLevel.ERROR, '登录失败', data.error);
            showError(data.error || '登录失败');
        }
    } catch (err) {
        loginLog(LogLevel.ERROR, '系统错误', err.message);
        showError('服务器错误，请重试');
    }
});
