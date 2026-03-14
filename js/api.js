// api.js - Versi final dengan dukungan endpoint getAllData, penanganan error, dan kompatibilitas penuh dengan loader.js
// - Mendukung JSONP untuk semua operasi (GET dan POST via action)
// - Dilengkapi logging, validasi respons, timeout, dan kompatibilitas penuh dengan Chrome
// - Menambahkan fungsi apiGetAllData() untuk mengambil semua data sekaligus (endpoint getAllData)
// (c) Masjid Al-Ikhlas Ngijo

(function(global) {
    'use strict';

    // ====================== KONFIGURASI DEFAULT ======================
    const CONFIG = global.CONFIG || {};
    // Tingkatkan batas URL untuk mengakomodasi data base64 (misal TTD)
    const MAX_URL_LENGTH = 4000; // dari sebelumnya 2000

    // ====================== FUNGSI INTERNAL JSONP ======================
    /**
     * Fungsi internal untuk menjalankan JSONP
     * @param {string} url URL lengkap dengan parameter (tanpa callback)
     * @returns {Promise}
     */
    function jsonpRequest(url) {
        return new Promise((resolve, reject) => {
            // Pastikan url valid
            if (!url || typeof url !== 'string') {
                reject(new Error('URL tidak valid'));
                return;
            }

            // Generate callback unik
            const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
            const separator = url.includes('?') ? '&' : '?';
            const fullUrl = url + separator + 'callback=' + encodeURIComponent(callbackName);

            // Cek panjang URL (kritis untuk data besar seperti base64)
            if (fullUrl.length > MAX_URL_LENGTH) {
                console.error('URL terlalu panjang:', fullUrl.length, 'karakter');
                reject(new Error('Data terlalu besar untuk dikirim via JSONP. Kurangi ukuran tanda tangan (misal perkecil canvas atau turunkan kualitas gambar).'));
                return;
            }

            const script = document.createElement('script');
            let timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout: Tidak ada respons dari server (10 detik)'));
            }, 10000);

            // Fungsi pembersih
            function cleanup() {
                clearTimeout(timeoutId);
                if (script.parentNode) script.parentNode.removeChild(script);
                delete global[callbackName];
                script.onload = script.onerror = null;
            }

            // Handler respons
            global[callbackName] = function(response) {
                console.log('📥 JSONP Response [' + callbackName + ']:', response);
                cleanup();
                try {
                    // Periksa apakah respons sukses sesuai format yang diharapkan
                    if (response && typeof response === 'object') {
                        // Jika respons memiliki properti success
                        if (response.hasOwnProperty('success')) {
                            if (response.success === true) {
                                // Jika ada data, kembalikan data, jika tidak kembalikan respons
                                resolve(response.data !== undefined ? response.data : response);
                            } else {
                                // success === false
                                reject(new Error(response.error || 'Operasi gagal di server'));
                            }
                        } else {
                            // Respons tidak memiliki properti success
                            // Periksa apakah ada properti 'error' (misal { error: "..." })
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                // Tidak ada success dan tidak ada error, kemungkinan data langsung
                                console.warn('⚠️ Respons JSONP tidak memiliki properti success atau error, menggunakan respons langsung:', response);
                                resolve(response);
                            }
                        }
                    } else if (response === null || response === undefined) {
                        reject(new Error('Respons kosong dari server'));
                    } else {
                        // Respons bukan objek (misalnya string) - kemungkinan error
                        reject(new Error('Respons tidak valid: ' + String(response)));
                    }
                } catch (e) {
                    reject(new Error('Gagal memproses respons: ' + e.message));
                }
            };

            console.log('📤 JSONP Request [' + callbackName + ']:', fullUrl);

            script.src = fullUrl;
            script.async = true;
            script.onerror = () => {
                cleanup();
                reject(new Error('Network error: Gagal memuat script JSONP. Periksa koneksi atau URL.'));
            };
            document.head.appendChild(script);
        });
    }

    // ====================== FUNGSI UTAMA API ======================
    /**
     * Fungsi publik untuk GET data (mengambil data dari endpoint)
     * @param {string} endpoint Nama sheet/endpoint (fitrah, mal, mustahik, dll)
     * @param {Object} params Parameter query tambahan (misal { rt: '01' })
     * @returns {Promise<Array|Object>}
     */
    function apiGet(endpoint, params = {}) {
        // Validasi konfigurasi
        if (!CONFIG || !CONFIG.API_URL) {
            return Promise.reject(new Error('API_URL tidak dikonfigurasi. Pastikan config.js dimuat dengan benar.'));
        }
        if (!endpoint || typeof endpoint !== 'string') {
            return Promise.reject(new Error('Endpoint harus diisi dan berupa string.'));
        }

        let url = `${CONFIG.API_URL}?endpoint=${encodeURIComponent(endpoint)}`;
        for (let key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                if (key === 'rt') {
                    // Format khusus: &rt04 (tanpa tanda =) karena backend mengharapkan parameter bernama rt04
                    url += `&rt${params[key]}`;
                } else {
                    url += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
                }
            }
        }
        return jsonpRequest(url);
    }

    /**
     * Fungsi untuk mengambil semua data sekaligus (menggunakan endpoint getAllData)
     * @returns {Promise<Object>} Objek dengan properti per sheet
     */
    function apiGetAllData() {
        if (!CONFIG || !CONFIG.API_URL) {
            return Promise.reject(new Error('API_URL tidak dikonfigurasi. Pastikan config.js dimuat dengan benar.'));
        }
        const url = `${CONFIG.API_URL}?endpoint=getAllData`;
        return jsonpRequest(url).then(response => {
            // response diharapkan berupa { success: true, data: { ... } } atau langsung data
            if (response && typeof response === 'object') {
                if (response.success === true && response.data) {
                    return response.data;
                }
                // Jika tidak ada properti success, asumsikan response langsung data
                return response;
            }
            return {};
        });
    }

    /**
     * Fungsi untuk operasi yang mengubah data via JSONP (GET dengan parameter action)
     * @param {string} action 'add', 'edit', 'update', 'delete', 'import', 'absen', dll
     * @param {string} endpoint Nama sheet/endpoint (bisa kosong untuk action tertentu seperti absen)
     * @param {Object|Array} data Data yang dikirim (akan di-JSON-stringify)
     * @returns {Promise}
     */
    function apiPostJSONP(action, endpoint, data) {
        if (!CONFIG || !CONFIG.API_URL) {
            return Promise.reject(new Error('API_URL tidak dikonfigurasi. Pastikan config.js dimuat dengan benar.'));
        }
        if (!action || typeof action !== 'string') {
            return Promise.reject(new Error('Action harus diisi dan berupa string.'));
        }
        // endpoint bisa kosong, jadi tidak divalidasi ketat
        if (data === undefined || data === null) {
            return Promise.reject(new Error('Data tidak boleh kosong.'));
        }

        let url = `${CONFIG.API_URL}?action=${encodeURIComponent(action)}`;
        if (endpoint) {
            url += `&endpoint=${encodeURIComponent(endpoint)}`;
        }
        // Stringify data
        try {
            const dataStr = JSON.stringify(data);
            // Peringatan jika data terlalu besar
            if (dataStr.length > 1500) {
                console.warn('Data JSON sangat besar (' + dataStr.length + ' karakter). Pastikan tidak melebihi batas URL.');
            }
            url += `&data=${encodeURIComponent(dataStr)}`;
        } catch (e) {
            return Promise.reject(new Error('Gagal mengkonversi data ke JSON: ' + e.message));
        }
        return jsonpRequest(url);
    }

    // ====================== WRAPPER FUNCTIONS ======================
    /**
     * Menambah data baru ke sheet tertentu
     * @param {string} endpoint Nama sheet
     * @param {Object} data Data baru (sesuai kolom di sheet)
     * @returns {Promise}
     */
    function apiPost(endpoint, data) {
        return apiPostJSONP('add', endpoint, data);
    }

    /**
     * Mengedit data (replace seluruh field) berdasarkan id
     * @param {string} endpoint Nama sheet
     * @param {string|number} id ID data yang akan diedit
     * @param {Object} data Data baru (semua field akan ditimpa)
     * @returns {Promise}
     */
    function apiEdit(endpoint, id, data) {
        if (!id && id !== 0) {
            return Promise.reject(new Error('ID diperlukan untuk operasi edit.'));
        }
        const payload = Object.assign({ id }, data);
        return apiPostJSONP('edit', endpoint, payload);
    }

    /**
     * Menghapus data berdasarkan id
     * @param {string} endpoint Nama sheet
     * @param {string|number} id ID data yang akan dihapus
     * @returns {Promise}
     */
    function apiDelete(endpoint, id) {
        if (!id && id !== 0) {
            return Promise.reject(new Error('ID diperlukan untuk operasi delete.'));
        }
        return apiPostJSONP('delete', endpoint, { id });
    }

    /**
     * Update sebagian field (misalnya untuk mengubah status) berdasarkan id
     * @param {string} endpoint Nama sheet
     * @param {string|number} id ID data yang akan diupdate
     * @param {Object} data Field-field yang akan diupdate
     * @returns {Promise}
     */
    function apiUpdate(endpoint, id, data) {
        if (!id && id !== 0) {
            return Promise.reject(new Error('ID diperlukan untuk operasi update.'));
        }
        return apiPostJSONP('update', endpoint, Object.assign({ id }, data));
    }

    /**
     * Impor banyak data sekaligus ke sheet tertentu
     * @param {string} endpoint Nama sheet
     * @param {Array} rows Array of objects (sesuai kolom sheet)
     * @returns {Promise}
     */
    function apiImport(endpoint, rows) {
        if (!Array.isArray(rows)) {
            return Promise.reject(new Error('Data import harus berupa array.'));
        }
        return apiPostJSONP('import', endpoint, { rows });
    }

    /**
     * Update settings (khusus untuk sheet settings)
     * @param {string} key Nama setting
     * @param {any} value Nilai baru
     * @returns {Promise}
     */
    function apiUpdateSettings(key, value) {
        if (!key) {
            return Promise.reject(new Error('Key diperlukan untuk update settings.'));
        }
        const data = {};
        data[key] = value;
        return apiPostJSONP('update', 'settings', data);
    }

    /**
     * Melakukan absensi petugas
     * @param {Object} dataAbsen { id_sesi, password, nama_petugas, latitude, longitude, ttd_base64 }
     * @returns {Promise}
     */
    function apiAbsen(dataAbsen) {
        if (!dataAbsen || typeof dataAbsen !== 'object') {
            return Promise.reject(new Error('Data absen harus berupa objek.'));
        }
        // Validasi minimal field yang diperlukan
        const required = ['id_sesi', 'password', 'nama_petugas', 'ttd_base64'];
        for (let field of required) {
            if (!dataAbsen[field]) {
                return Promise.reject(new Error(`Field '${field}' harus diisi.`));
            }
        }
        return apiPostJSONP('absen', '', dataAbsen);
    }

    /**
     * Mendapatkan daftar sesi yang sedang aktif (untuk dropdown absen)
     * @returns {Promise<Array>}
     */
    function apiGetSesiAktif() {
        return apiGet('sesi_aktif').then(response => {
            // Pastikan mengembalikan array
            if (Array.isArray(response)) {
                return response;
            } else if (response && typeof response === 'object' && Array.isArray(response.data)) {
                return response.data;
            } else {
                console.warn('Respons sesi_aktif tidak sesuai format, mengembalikan array kosong', response);
                return [];
            }
        });
    }

    // ====================== EKSPOR KE GLOBAL ======================
    global.apiGet = apiGet;
    global.apiGetAllData = apiGetAllData;
    global.apiPostJSONP = apiPostJSONP;
    global.apiPost = apiPost;
    global.apiEdit = apiEdit;
    global.apiDelete = apiDelete;
    global.apiUpdate = apiUpdate;
    global.apiImport = apiImport;
    global.apiUpdateSettings = apiUpdateSettings;
    global.apiAbsen = apiAbsen;
    global.apiGetSesiAktif = apiGetSesiAktif;

    // Opsional: export jika menggunakan module (untuk lingkungan Node.js, tidak wajib)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            apiGet,
            apiGetAllData,
            apiPostJSONP,
            apiPost,
            apiEdit,
            apiDelete,
            apiUpdate,
            apiImport,
            apiUpdateSettings,
            apiAbsen,
            apiGetSesiAktif
        };
    }

    console.log('✅ api.js v33.1 loaded. Fungsi API siap digunakan.');
})(window);