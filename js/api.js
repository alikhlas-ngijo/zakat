// api.js - Versi final dengan JSONP untuk semua operasi
// Dilengkapi logging, penanganan error, dan validasi

(function() {
  // Pastikan CONFIG tersedia
  if (typeof CONFIG === 'undefined' || !CONFIG.API_URL) {
    console.error('CONFIG tidak ditemukan atau API_URL tidak diatur! Pastikan config.js dimuat sebelum api.js');
  }

  /**
   * Fungsi internal untuk menjalankan JSONP
   * @param {string} url URL lengkap dengan parameter (tanpa callback)
   * @returns {Promise}
   */
  function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
      // Generate callback unik
      const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const script = document.createElement('script');
      let timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout: Tidak ada respons dari server (10 detik)'));
      }, 10000);

      function cleanup() {
        clearTimeout(timeoutId);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
      }

      // Handler respons
      window[callbackName] = function(response) {
        console.log('JSONP Response [' + callbackName + ']:', response);
        cleanup();
        try {
          // Periksa apakah respons sukses sesuai format yang diharapkan
          if (response && typeof response === 'object') {
            if (response.success === true) {
              // Jika ada data, kembalikan data, jika tidak kembalikan respons
              resolve(response.data !== undefined ? response.data : response);
            } else if (response.success === false) {
              reject(new Error(response.error || 'Operasi gagal di server'));
            } else {
              // Respons tidak memiliki properti success, tapi mungkin data langsung
              console.warn('Respons JSONP tidak memiliki properti success, mencoba resolve langsung:', response);
              resolve(response);
            }
          } else {
            reject(new Error('Respons tidak valid: ' + JSON.stringify(response)));
          }
        } catch (e) {
          reject(new Error('Gagal memproses respons: ' + e.message));
        }
      };

      // Tambahkan callback ke URL
      const separator = url.includes('?') ? '&' : '?';
      const fullUrl = url + separator + 'callback=' + callbackName;
      console.log('JSONP Request [' + callbackName + ']:', fullUrl);

      script.src = fullUrl;
      script.onerror = () => {
        cleanup();
        reject(new Error('Network error: Gagal memuat script JSONP. Periksa koneksi atau URL.'));
      };
      script.onload = () => {
        // Script berhasil dimuat, tapi respons akan ditangani oleh callback.
        // Tidak perlu action tambahan.
      };
      document.head.appendChild(script); // Gunakan head agar lebih cepat
    });
  }

  /**
   * Fungsi publik untuk GET data
   * @param {string} endpoint
   * @param {Object} params Parameter query
   * @returns {Promise<Array|Object>}
   */
  window.apiGet = function(endpoint, params = {}) {
    if (!CONFIG || !CONFIG.API_URL) {
      return Promise.reject(new Error('API_URL tidak dikonfigurasi'));
    }
    let url = `${CONFIG.API_URL}?endpoint=${encodeURIComponent(endpoint)}`;
    for (let key in params) {
      if (key === 'rt') {
        // Format khusus: &rt04 (tanpa tanda =) karena backend mengharapkan parameter bernama rt04
        url += `&rt${params[key]}`;
      } else {
        url += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
      }
    }
    return jsonpRequest(url);
  };

  /**
   * Fungsi untuk operasi yang mengubah data via JSONP (GET dengan parameter action)
   * @param {string} action 'add', 'edit', 'update', 'delete', 'import', dll
   * @param {string} endpoint
   * @param {Object|Array} data Data yang dikirim (akan di-JSON-stringify)
   * @returns {Promise}
   */
  window.apiPostJSONP = function(action, endpoint, data) {
    if (!CONFIG || !CONFIG.API_URL) {
      return Promise.reject(new Error('API_URL tidak dikonfigurasi'));
    }
    let url = `${CONFIG.API_URL}?action=${encodeURIComponent(action)}&endpoint=${encodeURIComponent(endpoint)}`;
    url += `&data=${encodeURIComponent(JSON.stringify(data))}`;
    return jsonpRequest(url);
  };

  // ========== Wrapper functions untuk kemudahan ==========

  /**
   * Menambah data baru
   * @param {string} endpoint
   * @param {Object} data
   * @returns {Promise}
   */
  window.apiPost = function(endpoint, data) {
    return window.apiPostJSONP('add', endpoint, data);
  };

  /**
   * Mengedit data (replace seluruh field)
   * @param {string} endpoint
   * @param {string} id
   * @param {Object} data
   * @returns {Promise}
   */
  window.apiEdit = function(endpoint, id, data) {
    const payload = { id, ...data };
    return window.apiPostJSONP('edit', endpoint, payload);
  };

  /**
   * Menghapus data berdasarkan id
   * @param {string} endpoint
   * @param {string} id
   * @returns {Promise}
   */
  window.apiDelete = function(endpoint, id) {
    return window.apiPostJSONP('delete', endpoint, { id });
  };

  /**
   * Update sebagian field (misalnya untuk mengubah status)
   * @param {string} endpoint
   * @param {string} id
   * @param {Object} data
   * @returns {Promise}
   */
  window.apiUpdate = function(endpoint, id, data) {
    return window.apiPostJSONP('update', endpoint, { id, ...data });
  };

  /**
   * Impor banyak data sekaligus
   * @param {string} endpoint
   * @param {Array} rows Array of objects
   * @returns {Promise}
   */
  window.apiImport = function(endpoint, rows) {
    return window.apiPostJSONP('import', endpoint, { rows });
  };

  /**
   * Update settings (khusus untuk sheet settings)
   * @param {string} key
   * @param {any} value
   * @returns {Promise}
   */
  window.apiUpdateSettings = function(key, value) {
    return window.apiPostJSONP('update', 'settings', { [key]: value });
  };

  /**
   * Melakukan absensi petugas
   * @param {Object} dataAbsen { id_sesi, password, nama_petugas, latitude, longitude, ttd_base64 }
   * @returns {Promise}
   */
  window.apiAbsen = function(dataAbsen) {
    return window.apiPostJSONP('absen', '', dataAbsen);
  };

  /**
   * Mendapatkan sesi yang aktif
   * @returns {Promise<Array>}
   */
  window.apiGetSesiAktif = function() {
    return window.apiGet('sesi_aktif');
  };

  // Opsional: export jika menggunakan module (untuk lingkungan Node.js, tidak wajib)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      apiGet: window.apiGet,
      apiPostJSONP: window.apiPostJSONP,
      apiPost: window.apiPost,
      apiEdit: window.apiEdit,
      apiDelete: window.apiDelete,
      apiUpdate: window.apiUpdate,
      apiImport: window.apiImport,
      apiUpdateSettings: window.apiUpdateSettings,
      apiAbsen: window.apiAbsen,
      apiGetSesiAktif: window.apiGetSesiAktif
    };
  }
})();