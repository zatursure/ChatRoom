// dom战神...
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置文件路径
const configPath = path.join(__dirname, 'config.json');

// 检查并创建配置文件
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    // 如果文件不存在或无法解析，创建新的配置
    const newPassword = crypto.randomBytes(8).toString('hex');
    config = { adminPassword: newPassword };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    console.log('\x1b[33m%s\x1b[0m', 'config.json不正确或不存在，已自动生成新的配置文件！');
    console.log('\x1b[33m%s\x1b[0m', '已自动生成新的管理员密码！');
    console.log('\x1b[32m%s\x1b[0m', `管理员密码: ${newPassword}`);
    console.log('\x1b[33m%s\x1b[0m', '请妥善保管此密码。');
}

const ADMIN_PASSWORD = config.adminPassword;

app.use(express.static('public'));

const users = new Set();
const mutedUsers = new Set();

const adminTokens = new Set();

// 管理员验证中间件
const validateAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (adminTokens.has(token)) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// 添加路由处理
app.get('/chat.html', (req, res) => {
    res.sendFile(__dirname + '/public/chat.html');
});

// 更新路由处理
app.get('/', (req, res) => {
    res.redirect('/chat');
});

app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/public/chat/index.html');
});

// API路由组
const apiRouter = express.Router();
app.use('/api', apiRouter);

apiRouter.post('/admin/verify', express.json(), (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        const token = Math.random().toString(36).substring(7);
        adminTokens.add(token);
        res.send(token);
    } else {
        res.status(401).send('密码错误');
    }
});

apiRouter.get('/admin/users', validateAdmin, (req, res) => {
    res.json(Array.from(users));
});

// 管理员路由组
const adminRouter = express.Router();
app.use('/admin', adminRouter);

adminRouter.get('/', validateAdmin, (req, res) => {
    res.sendFile(__dirname + '/public/admin/index.html');
});

adminRouter.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/admin/login.html');
});

// 添加404处理
app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/public/404.html');
});

// Socket.IO中间件
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (adminTokens.has(token)) {
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    console.log('收到连接请求 - SocketID: '+socket.id);
    
    socket.on('join', (username) => {
        // 如果是重新连接的用户，不进行重复检查
        if (socket.username === username) {
            socket.emit('join success', username);
            return;
        }
        
        // 检查用户名是否已存在
        if (users.has(username)) {
            socket.emit('join error', '该用户名已被使用，请选择其他用户名');
            return;
        }
        if (!username || username.trim().length === 0) {
            socket.emit('join error', '用户名不能为空');
            return;
        }

        // 如果该socket之前有用户名，先删除旧的
        if (socket.username) {
            users.delete(socket.username);
        }

        users.add(username);
        socket.username = username;
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
            targetSocket[1].emit('kicked');
            targetSocket[1].disconnect();
        }
    });

    socket.on('toggleMute', (username) => {
        if (mutedUsers.has(username)) {
            mutedUsers.delete(username);
            io.emit('userUnmuted', username);
        } else {
            mutedUsers.add(username);
            io.emit('userMuted', username);
        }
        // 发送更新后的禁言列表
        io.emit('mutedList', Array.from(mutedUsers));
    });

    socket.on('announcement', (text) => {
        io.emit('notification', {
            type: 'announcement',
            message: text,
            duration: 5000
        });
    });

    socket.on('chat message', (msg) => {
        if (mutedUsers.has(socket.username)) {
            socket.emit('notification', {
                type: 'warning',
                message: '您已被禁言，暂时无法发送消息',
                duration: 3000
            });
            return;
        }
        io.emit('chat message', {
            username: socket.username,
            message: msg,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });

    socket.on('stop typing', (username) => {
        socket.broadcast.emit('stop typing', username);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            io.emit('userLeft', socket.username);
            io.emit('userList', Array.from(users));
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('欢迎使用ChatRoom - By Zatursure！')
    console.log('--------------------------------')
    console.log(`服务运行在 http://localhost:${PORT}`);
});
