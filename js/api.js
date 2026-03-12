// api.js - Versi final dengan JSONP untuk semua operasi
// Dilengkapi logging dan penanganan error yang lebih baik

/**
 * Fungsi internal untuk menjalankan JSONP
 * @param {string} url URL dasar dengan parameter yang sudah disusun (tanpa callback)
 * @returns {Promise}
 */
function jsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout: Tidak ada respons dari server (10 detik)'));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = function(response) {
      console.log('JSONP Response:', response); // Log respons untuk debugging
      cleanup();
      // Periksa apakah respons sukses
      if (response && response.success === true) {
        // Jika ada data, kembalikan data, jika tidak kembalikan respons
        resolve(response.data !== undefined ? response.data : response);
      } else if (response && response.success === false) {
        reject(new Error(response.error || 'Operasi gagal di server'));
      } else {
        // Respons tidak sesuai format, tapi mungkin sukses (misal langsung data)
        resolve(response);
      }
    };

    // Tambahkan callback ke URL
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = url + separator + 'callback=' + callbackName;
    console.log('JSONP Request:', fullUrl); // Log URL untuk debugging

    script.src = fullUrl;
    script.onerror = () => {
      cleanup();
      reject(new Error('Network error: Gagal memuat script JSONP. Periksa koneksi atau URL.'));
    };
    document.body.appendChild(script);
  });
}

/**
 * Fungsi publik untuk GET data
 * @param {string} endpoint
 * @param {Object} params Parameter query
 * @returns {Promise<Array|Object>}
 */
function apiGet(endpoint, params = {}) {
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
}

/**
 * Fungsi untuk operasi yang mengubah data via JSONP (GET dengan parameter action)
 * @param {string} action 'add', 'edit', 'update', 'delete', 'import', dll
 * @param {string} endpoint
 * @param {Object|Array} data Data yang dikirim (akan di-JSON-stringify)
 * @returns {Promise}
 */
function apiPostJSONP(action, endpoint, data) {
  let url = `${CONFIG.API_URL}?action=${encodeURIComponent(action)}&endpoint=${encodeURIComponent(endpoint)}`;
  // Serialize data ke JSON dan encode
  url += `&data=${encodeURIComponent(JSON.stringify(data))}`;
  return jsonpRequest(url);
}

// ========== Wrapper functions untuk kemudahan ==========

/**
 * Menambah data baru
 * @param {string} endpoint
 * @param {Object} data
 * @returns {Promise}
 */
function apiPost(endpoint, data) {
  return apiPostJSONP('add', endpoint, data);
}

/**
 * Mengedit data (replace seluruh field)
 * @param {string} endpoint
 * @param {string} id
 * @param {Object} data
 * @returns {Promise}
 */
function apiEdit(endpoint, id, data) {
  // Pastikan id ada di dalam data (untuk memudahkan backend)
  const payload = { id, ...data };
  return apiPostJSONP('edit', endpoint, payload);
}

/**
 * Menghapus data berdasarkan id
 * @param {string} endpoint
 * @param {string} id
 * @returns {Promise}
 */
function apiDelete(endpoint, id) {
  return apiPostJSONP('delete', endpoint, { id });
}

/**
 * Update sebagian field (misalnya untuk mengubah status)
 * @param {string} endpoint
 * @param {string} id
 * @param {Object} data
 * @returns {Promise}
 */
function apiUpdate(endpoint, id, data) {
  return apiPostJSONP('update', endpoint, { id, ...data });
}

/**
 * Impor banyak data sekaligus
 * @param {string} endpoint
 * @param {Array} rows Array of objects
 * @returns {Promise}
 */
function apiImport(endpoint, rows) {
  return apiPostJSONP('import', endpoint, { rows });
}

/**
 * Update settings (khusus untuk sheet settings)
 * @param {string} key
 * @param {any} value
 * @returns {Promise}
 */
function apiUpdateSettings(key, value) {
  return apiPostJSONP('update', 'settings', { [key]: value });
}

/**
 * Melakukan absensi petugas
 * @param {Object} dataAbsen { id_sesi, password, nama_petugas, latitude, longitude, ttd_base64 }
 * @returns {Promise}
 */
function apiAbsen(dataAbsen) {
  return apiPostJSONP('absen', '', dataAbsen);
}

/**
 * Mendapatkan sesi yang aktif
 * @returns {Promise<Array>}
 */
function apiGetSesiAktif() {
  return apiGet('sesi_aktif');
}