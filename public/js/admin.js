const socket = io();
const adminPassword = 'admin123'; // 实际应用中应该使用更安全的认证方式

// 验证管理员身份
function authenticate() {
    const password = prompt('请输入管理员密码：');
    if (password !== adminPassword) {
        alert('密码错误！');
        window.location.href = '/';
        return false;
    }
    return true;
}

if (!authenticate()) {
    window.location.href = '/';
    return;
}

// 管理功能实现
socket.on('userList', (users) => {
    const userList = document.getElementById('adminUserList');
    userList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <span>${user}</span>
            <div class="user-actions">
                <button onclick="kickUser('${user}')">踢出</button>
                <button onclick="toggleMute('${user}')">禁言</button>
            </div>
        `;
        userList.appendChild(userItem);
    });
});

// 发送公告
document.getElementById('sendAnnouncement').addEventListener('click', () => {
    const text = document.getElementById('announcementText').value;
    if (text.trim()) {
        socket.emit('announcement', text);
        document.getElementById('announcementText').value = '';
    }
});

// 踢出用户
function kickUser(username) {
    if (confirm(`确定要踢出用户 ${username}?`)) {
        socket.emit('kick', username);
    }
}

// 禁言用户
function toggleMute(username) {
    socket.emit('toggleMute', username);
}
