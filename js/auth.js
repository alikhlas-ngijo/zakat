// auth.js - Login dengan JSONP dan konversi RT ke dua digit
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        alert('Email dan password harus diisi!');
        return;
    }

    const callbackName = 'login_cb_' + Date.now();
    window[callbackName] = function(response) {
        if (response.success) {
            const user = response.data;
            // Pastikan RT dalam format dua digit (misal "4" -> "04")
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
        } else {
            alert(response.error || 'Login gagal. Periksa email dan password.');
        }
        // Bersihkan script dan callback
        document.body.removeChild(script);
        delete window[callbackName];
    };

    const script = document.createElement('script');
    script.src = `${CONFIG.API_URL}?endpoint=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&callback=${callbackName}`;
    script.onerror = function() {
        alert('Gagal menghubungi server. Periksa koneksi atau URL API.');
        document.body.removeChild(script);
        delete window[callbackName];
    };
    document.body.appendChild(script);
});