// auth.js - Final version with robust error handling and api.js integration

// Ensure api.js is loaded properly
if (typeof apiGet === 'undefined') {
    alert('Kesalahan: File api.js tidak ditemukan atau gagal dimuat. Periksa kembali include script di HTML.');
    throw new Error('apiGet is not defined');
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    // Basic validation
    if (!email || !password) {
        alert('Email dan password harus diisi!');
        return;
    }

    // Disable button to prevent double submission
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';

    try {
        console.log('Login attempt with:', { email, password });

        // Call login endpoint via apiGet (from api.js)
        const user = await apiGet('login', { email, password });

        // Validate response: must be an object with role property
        if (!user || typeof user !== 'object') {
            throw new Error('Respons dari server tidak valid.');
        }

        // Ensure RT is in two-digit format (e.g., "4" → "04")
        if (user.rt !== undefined && user.rt !== null) {
            user.rt = user.rt.toString().padStart(2, '0');
        }

        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Redirect based on role
        if (user.role === 'admin') {
            window.location.href = 'admin/dashboard.html';
        } else if (user.role === 'koordinator') {
            window.location.href = 'koordinator/dashboard.html';
        } else {
            alert('Role tidak dikenali: ' + user.role);
        }
    } catch (error) {
        console.error('Login error:', error);

        // Friendly error messages
        let errorMessage = error.message;
        if (error.message.includes('Network error') || error.message.includes('Timeout')) {
            errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
        } else if (error.message.includes('not found') || error.message.includes('unauthorized') || error.message.includes('gagal')) {
            errorMessage = 'Email atau password salah.';
        }

        alert('Login gagal: ' + errorMessage);

        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
});