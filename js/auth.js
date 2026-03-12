// auth.js - Login menggunakan api.js (JSONP dengan penanganan error yang matang)
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        alert('Email dan password harus diisi!');
        return;
    }

    try {
        // Menggunakan apiGet yang sudah didefinisikan di api.js
        // Endpoint 'login' dengan parameter email dan password
        const user = await apiGet('login', { email, password });

        // Pastikan format RT dua digit
        if (user.rt !== undefined && user.rt !== null) {
            user.rt = user.rt.toString().padStart(2, '0');
        }

        // Simpan user ke localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Redirect sesuai role
        if (user.role === 'admin') {
            window.location.href = 'admin/dashboard.html';
        } else if (user.role === 'koordinator') {
            window.location.href = 'koordinator/dashboard.html';
        } else {
            alert('Role tidak dikenal: ' + user.role);
        }
    } catch (error) {
        // Menampilkan pesan error dari server atau jaringan
        alert('Login gagal: ' + error.message);
        console.error('Detail error:', error);
    }
});