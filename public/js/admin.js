document.addEventListener('DOMContentLoaded', () => {
    // === AUTHENTICATION & AUTHORIZATION CHECK ===
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user'));

    // Nếu không có token hoặc user không phải admin, đá về trang chính
    if (!token || !user || user.role !== 'admin') {
        alert('Bạn không có quyền truy cập trang này!');
        window.location.href = '/index.html';
        return;
    }

    // === UI ELEMENTS ===
    const userForm = document.getElementById('user-form');
    const formTitle = document.getElementById('form-title');
    const userIdInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const roleInput = document.getElementById('role');
    const userListBody = document.getElementById('user-list-body');
    const cancelBtn = document.getElementById('cancel-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // === FUNCTIONS ===

    /**
     * Lấy danh sách người dùng từ API và hiển thị ra bảng
     */
    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Không thể lấy danh sách người dùng.');
            }
            const users = await response.json();
            renderUserTable(users);
        } catch (error) {
            alert(error.message);
        }
    };

    /**
     * Hiển thị dữ liệu người dùng lên bảng
     * @param {Array} users - Mảng các đối tượng user
     */
    const renderUserTable = (users) => {
        userListBody.innerHTML = ''; // Xóa nội dung cũ
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>
                    <button class="edit-btn" data-id="${u.id}" data-username="${u.username}" data-role="${u.role}"><i class="fa-solid fa-pencil"></i> Sửa</button>
                    <button class="delete-btn" data-id="${u.id}" data-username="${u.username}" style="background-color: var(--error-color);"><i class="fa-solid fa-trash"></i> Xóa</button>
                </td>
            `;
            userListBody.appendChild(tr);
        });
    };

    /**
     * Reset form về trạng thái ban đầu (thêm mới)
     */
    const resetForm = () => {
        userForm.reset();
        userIdInput.value = '';
        formTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Thêm người dùng mới';
        passwordInput.placeholder = '';
    };

    /**
     * Xử lý sự kiện submit form (thêm mới hoặc cập nhật)
     */
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const userId = userIdInput.value;
        const userData = {
            username: usernameInput.value,
            password: passwordInput.value,
            role: roleInput.value
        };

        // Nếu không nhập mật khẩu khi sửa, thì không gửi trường password
        if (userId && !userData.password) {
            delete userData.password;
        }

        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `/api/users/${userId}` : '/api/users';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Thao tác thất bại.');
            }
            
            alert(userId ? 'Cập nhật người dùng thành công!' : 'Thêm người dùng thành công!');
            resetForm();
            fetchUsers(); // Tải lại danh sách

        } catch (error) {
            alert(error.message);
        }
    };

    /**
     * Xử lý các click trên bảng (sửa, xóa)
     */
    const handleTableClick = (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const userId = target.dataset.id;

        // Xử lý nút Sửa
        if (target.classList.contains('edit-btn')) {
            formTitle.innerHTML = '<i class="fa-solid fa-pencil"></i> Sửa người dùng';
            userIdInput.value = userId;
            usernameInput.value = target.dataset.username;
            roleInput.value = target.dataset.role;
            passwordInput.value = '';
            passwordInput.placeholder = 'Nhập mật khẩu mới nếu muốn thay đổi';
            window.scrollTo(0, 0); // Cuộn lên đầu trang
        }

        // Xử lý nút Xóa
        if (target.classList.contains('delete-btn')) {
            const username = target.dataset.username;
            if (confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}"?`)) {
                deleteUser(userId);
            }
        }
    };

    /**
     * Gửi yêu cầu xóa user đến API
     */
    const deleteUser = async (userId) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Xóa thất bại.');
            }
            alert('Xóa người dùng thành công!');
            fetchUsers(); // Tải lại danh sách

        } catch (error) {
            alert(error.message);
        }
    };

    // === EVENT LISTENERS ===
    userForm.addEventListener('submit', handleFormSubmit);
    userListBody.addEventListener('click', handleTableClick);
    cancelBtn.addEventListener('click', resetForm);
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    });

    // === INITIALIZATION ===
    fetchUsers(); // Tải danh sách người dùng khi trang được mở
});