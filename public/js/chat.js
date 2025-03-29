const socket = io();
const username = sessionStorage.getItem('username');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const themeToggle = document.getElementById('themeToggle');

let typingTimeout;

// 修复表情选择器初始化
async function initEmoji() {
    const picker = new EmojiMart.Picker({
        data: await (await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data')).json(),
        onEmojiSelect: (emoji) => {
            input.value += emoji.native;
            emojiPicker.style.display = 'none';
        }
    });
    emojiPicker.innerHTML = '';
    emojiPicker.appendChild(picker);
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    if (!username) {
        window.location.href = '/';
        return;
    }

    initEmoji();
    initTheme();
    socket.emit('join', username);
});

// 修复表情按钮点击事件
emojiButton.onclick = (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
};

// 点击其他地方关闭表情选择器
document.addEventListener('click', (e) => {
    if (!emojiButton.contains(e.target) && !emojiPicker.contains(e.target)) {
        emojiPicker.style.display = 'none';
    }
});

// 修改输入状态处理
input.addEventListener('input', () => {
    socket.emit('typing', username);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing', username);
    }, 1000);
});

// 修复消息发送和接收
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) {
        socket.emit('chat message', input.value);
        input.value = '';
    }
});

// 修复主题切换逻辑
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
});

initTheme();

// 修改chat message事件处理，移除声音相关代码
socket.on('chat message', (data) => {
    const item = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    
    if (data.username === username) {
        item.className = 'message-self';
        item.innerHTML = `
            ${data.message}
            <div class="message-time">${time}</div>
        `;
    } else {
        item.className = 'message-others';
        item.innerHTML = `
            ${data.username}: ${data.message}
            <div class="message-time">${time}</div>
        `;
    }
    
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});

// 修改输入状态提示显示逻辑
socket.on('typing', (user) => {
    if (user !== username) {
        let typingDiv = document.getElementById(`typing-${user}`);
        if (!typingDiv) {
            typingDiv = document.createElement('div');
            typingDiv.className = 'typing-indicator';
            typingDiv.id = `typing-${user}`;
            typingDiv.textContent = `${user} 正在输入...`;
            messages.appendChild(typingDiv);
        }
    }
});

socket.on('stop typing', (user) => {
    const typingDiv = document.getElementById(`typing-${user}`);
    if (typingDiv) {
        typingDiv.remove();
    }
});

socket.on('userJoined', (username) => {
    const item = document.createElement('li');
    item.className = 'system-message';
    item.textContent = `${username} 加入了聊天室`;
    messages.appendChild(item);
});

socket.on('userLeft', (username) => {
    const item = document.createElement('li');
    item.className = 'system-message';
    item.textContent = `${username} 离开了聊天室`;
    messages.appendChild(item);
});

socket.on('userList', (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        userList.appendChild(li);
    });
});

// 添加管理员功能相关的事件处理
socket.on('kicked', () => {
    alert('您已被管理员踢出聊天室');
    window.location.href = '/';
});

socket.on('muted', () => {
    alert('您已被禁言');
});

socket.on('userMuted', (username) => {
    const item = document.createElement('li');
    item.className = 'system-message';
    item.textContent = `${username} 已被禁言`;
    messages.appendChild(item);
});

socket.on('userUnmuted', (username) => {
    const item = document.createElement('li');
    item.className = 'system-message';
    item.textContent = `${username} 已被解除禁言`;
    messages.appendChild(item);
});

socket.on('announcement', (text) => {
    const item = document.createElement('li');
    item.className = 'system-message announcement';
    item.innerHTML = `<strong>公告：</strong>${text}`;
    messages.appendChild(item);
});
