const socket = io();
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showError('用户名不能为空');
        return;
    }
    socket.emit('join', username);
});

socket.on('join error', (message) => {
    showError(message);
});

socket.on('join success', (username) => {
    // 存储用户名并跳转到聊天页面
    sessionStorage.setItem('username', username);
    window.location.href = '/chat';
});
