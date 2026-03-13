// auth.js - Final version with enhanced error handling and validation
(function() {
    // Pastikan DOM sudah siap
    document.addEventListener('DOMContentLoaded', function() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) {
            console.error('Elemen loginForm tidak ditemukan di halaman!');
            return;
        }

        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Ambil elemen input
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = this.querySelector('button[type="submit"]');
            
            if (!emailInput || !passwordInput || !submitBtn) {
                alert('Terjadi kesalahan pada form. Hubungi administrator.');
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const originalBtnText = submitBtn.innerHTML;

            // Validasi input
            if (!email || !password) {
                alert('Email dan password harus diisi!');
                return;
            }

            // Validasi format email sederhana
            if (!email.includes('@') || !email.includes('.')) {
                alert('Format email tidak valid!');
                return;
            }

            // Disable tombol
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';

            try {
                // Pastikan fungsi apiGet tersedia
                if (typeof window.apiGet !== 'function') {
                    throw new Error('Fungsi API tidak tersedia. Periksa koneksi atau muat ulang halaman.');
                }

                console.log('Mencoba login dengan:', { email, password });

                // Panggil endpoint login via apiGet (dari api.js)
                // apiGet akan mengembalikan data langsung (setelah diproses oleh api.js)
                const response = await window.apiGet('login', { email, password });

                console.log('Respons login:', response);

                // Validasi respons
                if (!response || typeof response !== 'object') {
                    throw new Error('Respons dari server tidak valid.');
                }

                // Jika respons memiliki properti error (misal dari server: { success: false, error: ... })
                if (response.error) {
                    throw new Error(response.error);
                }

                // Respons bisa langsung berisi objek user, atau { success: true, data: user }
                let user = response;
                if (response.success === true && response.data) {
                    user = response.data;
                }

                // Pastikan user memiliki properti yang diperlukan
                if (!user || !user.email || !user.role) {
                    throw new Error('Data user tidak lengkap dari server.');
                }

                // Format RT dua digit jika ada
                if (user.rt !== undefined && user.rt !== null) {
                    user.rt = user.rt.toString().padStart(2, '0');
                } else {
                    user.rt = ''; // pastikan ada
                }

                // Simpan user ke localStorage
                localStorage.setItem('user', JSON.stringify(user));

                // Redirect berdasarkan role
                if (user.role === 'admin') {
                    window.location.href = 'admin/dashboard.html';
                } else if (user.role === 'koordinator') {
                    window.location.href = 'koordinator/dashboard.html';
                } else {
                    alert('Role tidak dikenali: ' + user.role);
                    // Kembalikan tombol ke normal
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            } catch (error) {
                console.error('Login error:', error);

                // Pesan error yang lebih ramah
                let errorMessage = error.message;
                if (error.message.includes('Network error') || error.message.includes('Timeout')) {
                    errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
                } else if (error.message.toLowerCase().includes('not found') || 
                           error.message.toLowerCase().includes('unauthorized') || 
                           error.message.toLowerCase().includes('gagal') ||
                           error.message.toLowerCase().includes('salah')) {
                    errorMessage = 'Email atau password salah.';
                } else if (error.message.includes('Fungsi API tidak tersedia')) {
                    errorMessage = 'Terjadi kesalahan teknis. Muat ulang halaman.';
                }

                alert('Login gagal: ' + errorMessage);

                // Aktifkan kembali tombol
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    });
})();