document.addEventListener('DOMContentLoaded', () => {
    // === AUTHENTICATION & UI SETUP ===
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    const mainHeader = document.querySelector('.main-header');
    if (mainHeader && user) {
        const userInfoHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <span>Xin chào, <strong>${user.username}</strong> (${user.role})</span>
                <div>
                    ${user.role === 'admin' ? '<a href="/admin.html" style="margin-right: 15px; text-decoration: none; font-weight: 500;"><i class="fa-solid fa-user-shield"></i> Quản lý</a>' : ''}
                    <button id="logout-btn" style="background: var(--error-color);"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
                </div>
            </div>
        `;
        mainHeader.insertAdjacentHTML('beforeend', userInfoHtml);

        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }

    // === ORIGINAL APP LOGIC ===
    const switchTo417Btn = document.getElementById('switch-to-417');
    const switchTo128Btn = document.getElementById('switch-to-128');
    const app417Container = document.getElementById('app-417-container');
    const app128Container = document.getElementById('app-128-container');

    function switchApp(appToShow) {
        if (appToShow === '417') {
            app417Container.classList.remove('hidden');
            app128Container.classList.add('hidden');
            switchTo417Btn.classList.add('active');
            switchTo128Btn.classList.remove('active');
        } else {
            app417Container.classList.add('hidden');
            app128Container.classList.remove('hidden');
            switchTo417Btn.classList.remove('active');
            switchTo128Btn.classList.add('active');
        }
    }

    switchTo417Btn.addEventListener('click', () => switchApp('417'));
    switchTo128Btn.addEventListener('click', () => switchApp('128'));
    
    async function exportCanvasesToDirectory(canvases, filenames) {
        if (canvases.length === 0) {
            alert("Không có ảnh nào để xuất.");
            return;
        }

        if (window.showDirectoryPicker) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                for (let i = 0; i < canvases.length; i++) {
                    const blob = await new Promise(resolve => canvases[i].toBlob(resolve, 'image/png'));
                    const fileHandle = await dirHandle.getFileHandle(filenames[i], { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                }
                alert(`Đã xuất thành công ${canvases.length} ảnh!`);
            } catch (err) {
                if (err.name !== 'AbortError') console.error("Lỗi khi xuất ảnh:", err);
            }
        } else {
            for (let i = 0; i < canvases.length; i++) {
                const link = document.createElement('a');
                link.download = filenames[i];
                link.href = canvases[i].toDataURL('image/png');
                link.click();
            }
        }
    }

    initializePdf417Generator(); // Gọi hàm khởi tạo UI cho PDF417
    initializeCode128Generator(exportCanvasesToDirectory);

    switchApp('417');
});