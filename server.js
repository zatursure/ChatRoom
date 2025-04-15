const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const cookieParser = require('cookie-parser');

// 日志级别枚举
const LogLevel = {
    ERROR: 0,   // 错误
    WARN: 1,    // 警告
    INFO: 2,    // 重要信息
    DEBUG: 3    // 调试信息
};

// 当前日志级别
const currentLogLevel = LogLevel.INFO;

// 优化后的日志函数
function log(level, type, message, data = null) {
    if (level > currentLogLevel) return;
    
    const timestamp = new Date().toLocaleString('zh-CN');
    let color;
    let prefix;
    
    switch(level) {
        case LogLevel.ERROR:
            color = '\x1b[31m'; // 红色
            prefix = 'ERROR';
            break;
        case LogLevel.WARN:
            color = '\x1b[33m'; // 黄色
            prefix = 'WARN';
            break;
        case LogLevel.INFO:
            color = '\x1b[36m'; // 青色
            prefix = 'INFO';
            break;
        case LogLevel.DEBUG:
            color = '\x1b[90m'; // 灰色
            prefix = 'DEBUG';
            break;
    }
    
    console.log(`${color}[${timestamp}] [${prefix}] [${type}] ${message}\x1b[0m`);
    if (data && level <= LogLevel.INFO) {
        console.log('\x1b[90m%s\x1b[0m', JSON.stringify(data, null, 2));
    }
}

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules')); // 添加对node_modules的静态文件服务
app.use(express.json());
app.use(cookieParser());

const users = new Set();
const mutedUsers = new Set();
const sessions = new Map(); // 存储会话信息

// 添加登录接口
app.post('/login', (req, res) => {
    const { username } = req.body;
    log(LogLevel.INFO, '登录请求', `用户尝试登录: ${username}`);
    
    if (!username || username.trim().length === 0) {
        log(LogLevel.WARN, '登录失败', '用户名为空');
        return res.status(400).json({ error: '用户名不能为空' });
    }
    
    if (users.has(username)) {
        log(LogLevel.WARN, '登录失败', `用户名已存在: ${username}`);
        return res.status(400).json({ error: '该用户名已被使用' });
    }
    
    const sessionId = Math.random().toString(36).substring(2);
    sessions.set(sessionId, { username });
    log(LogLevel.INFO, '登录成功', `用户: ${username}`, { sessionId });
    
    res.json({ 
        sessionId,
        username 
    });
});

// 会话验证中间件
const validateSession = (req, res, next) => {
    const sessionId = req.query.sessionId || req.cookies.sessionId;
    log(LogLevel.INFO, '会话验证', `验证会话ID: ${sessionId}`);
    
    if (!sessionId || !sessions.has(sessionId)) {
        log(LogLevel.ERROR, '会话验证失败', `无效的会话ID: ${sessionId}`);
        return res.redirect('/?error=invalid_session');
    }
    req.session = sessions.get(sessionId);
    log(LogLevel.INFO, '会话验证成功', `用户: ${req.session.username}`);
    next();
};

// 添加路由处理
app.get('/chat.html', (req, res) => {
    res.sendFile(__dirname + '/public/chat.html');
});

// 应用会话验证到聊天页面
app.get('/chat', validateSession, (req, res) => {
    res.sendFile(__dirname + '/public/chat/index.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin/index.html');
});

// Socket.IO 连接验证
io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    log(LogLevel.INFO, 'Socket验证', `验证Socket连接, SessionID: ${sessionId}`);
    
    if (!sessionId || !sessions.has(sessionId)) {
        log(LogLevel.ERROR, 'Socket验证失败', `无效的SessionID: ${sessionId}`);
        return next(new Error('未授权'));
    }
    const session = sessions.get(sessionId);
    socket.sessionId = sessionId;
    socket.username = session.username;
    log(LogLevel.INFO, 'Socket验证成功', `用户: ${session.username}`);
    next();
});

io.on('connection', (socket) => {
    log(LogLevel.INFO, '用户连接', `SocketID: ${socket.id}, 用户名: ${socket.username}`);
    
    // 将用户加入用户集合
    users.add(socket.username);
    
    // 立即发送当前用户列表给新连接的用户
    socket.emit('userList', Array.from(users));
    // 向其他用户广播新用户加入
    socket.broadcast.emit('userJoined', socket.username);
    
    socket.on('join', (username) => {
        log(LogLevel.INFO, '加入请求', `用户: ${username}, SocketID: ${socket.id}`);
        
        // 如果是重新连接的用户，不进行重复检查
        if (socket.username === username) {
            log(LogLevel.INFO, '重连接', `用户重新连接: ${username}`);
            socket.emit('join success', username);
            return;
        }
        
        // 检查用户名是否已存在
        if (users.has(username)) {
            log(LogLevel.WARN, '加入失败', `用户名已存在: ${username}`);
            socket.emit('join error', '该用户名已被使用，请选择其他用户名');
            return;
        }
        if (!username || username.trim().length === 0) {
            log(LogLevel.WARN, '加入失败', '用户名为空');
            socket.emit('join error', '用户名不能为空');
            return;
        }

        // 如果该socket之前有用户名，先删除旧的
        if (socket.username) {
            log(LogLevel.INFO, '用户更新', `旧用户名: ${socket.username}, 新用户名: ${username}`);
            users.delete(socket.username);
        }

        users.add(username);
        socket.username = username;
        log(LogLevel.INFO, '加入成功', `用户: ${username}`);
        socket.emit('join success', username);
        io.emit('userJoined', username);
        io.emit('userList', Array.from(users));
    });

    // 管理员功能
    socket.on('kick', (username) => {
        // 验证管理员权限逻辑应该在这里
        const targetSocket = Array.from(io.sockets.sockets).find(
            ([_, s]) => s.username === username
        );
        if (targetSocket) {
            log(LogLevel.WARN, '踢出用户', `用户名: ${username}`);
            targetSocket[1].emit('kicked');
            targetSocket[1].disconnect();
        }
    });

    socket.on('toggleMute', (username) => {
        if (mutedUsers.has(username)) {
            mutedUsers.delete(username);
            log(LogLevel.INFO, '取消禁言', `用户名: ${username}`);
            io.emit('userUnmuted', username);
        } else {
            mutedUsers.add(username);
            log(LogLevel.WARN, '禁言用户', `用户名: ${username}`);
            io.emit('userMuted', username);
        }
    });

    socket.on('announcement', (text) => {
        log(LogLevel.INFO, '公告', `内容: ${text}`);
        io.emit('announcement', text);
    });

    socket.on('chat message', (msg) => {
        if (mutedUsers.has(socket.username)) {
            log(LogLevel.WARN, '消息被屏蔽', `用户: ${socket.username}, 内容: ${msg}`);
            socket.emit('muted');
            return;
        }
        log(LogLevel.DEBUG, '聊天消息', `用户: ${socket.username}, 内容: ${msg}`);
        io.emit('chat message', {
            username: socket.username,
            message: msg
        });
    });

    socket.on('typing', (username) => {
        log(LogLevel.DEBUG, '用户正在输入', `用户名: ${username}`);
        socket.broadcast.emit('typing', username);
    });

    socket.on('stop typing', (username) => {
        log(LogLevel.DEBUG, '用户停止输入', `用户名: ${username}`);
        socket.broadcast.emit('stop typing', username);
    });

    socket.on('disconnect', () => {
        log(LogLevel.INFO, '用户断开', `用户: ${socket.username}, SocketID: ${socket.id}`);
        if (socket.username) {
            users.delete(socket.username);
            io.emit('userLeft', socket.username);
            io.emit('userList', Array.from(users));
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    log(LogLevel.INFO, '服务器启动', `服务运行在 http://localhost:${PORT}`);
});
