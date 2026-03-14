// js/loader.js - Versi final dengan dukungan getAllData, lazy loading, dan cache cerdas
// (c) Masjid Al-Ikhlas Ngijo

(function() {
    'use strict';

    // Daftar sheet yang dikelola (sesuai dengan endpoint di backend)
    const CACHE_KEYS = [
        'fitrah', 'mal', 'fidyah', 'mustahik', 'pezakat', 'lokasi_izin',
        'sesi_absen', 'absen_petugas', 'kategori_mustahik', 'settings'
    ];

    // Masa berlaku cache di localStorage (1 jam)
    const CACHE_EXPIRY = 60 * 60 * 1000; // milidetik

    // ====================== FUNGSI INTERNAL CACHE ======================
    function getSessionCache(key) {
        const cached = sessionStorage.getItem('cache_' + key);
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch (e) {
            return null;
        }
    }

    function setSessionCache(key, data) {
        sessionStorage.setItem('cache_' + key, JSON.stringify(data));
    }

    function getLocalCache(key) {
        const itemStr = localStorage.getItem('cache_' + key);
        if (!itemStr) return null;
        try {
            const item = JSON.parse(itemStr);
            // Periksa kadaluarsa
            if (Date.now() - item.timestamp > CACHE_EXPIRY) {
                localStorage.removeItem('cache_' + key);
                return null;
            }
            return item.data;
        } catch (e) {
            return null;
        }
    }

    function setLocalCache(key, data) {
        const item = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem('cache_' + key, JSON.stringify(item));
    }

    /**
     * Mendapatkan data dari cache, prioritas sessionStorage > localStorage
     * @param {string} key
     * @returns {Array|Object|null}
     */
    function getCachedData(key) {
        return getSessionCache(key) || getLocalCache(key);
    }

    /**
     * Menyimpan data ke cache
     * @param {string} key
     * @param {*} data
     * @param {boolean} useLocalStorage - true untuk localStorage, false untuk sessionStorage
     */
    function setCachedData(key, data, useLocalStorage = false) {
        if (useLocalStorage) {
            setLocalCache(key, data);
        } else {
            setSessionCache(key, data);
        }
    }

    // ====================== FUNGSI PUBLIK ======================

    /**
     * Memuat beberapa endpoint sekaligus (per-endpoint)
     * @param {string|string[]} endpoints - Nama endpoint atau array endpoint
     * @param {boolean} forceRefresh - Abaikan cache dan paksa ambil dari API
     * @param {boolean} useLocalStorage - Simpan ke localStorage (expiry 1 jam)
     * @param {function} onProgress - Callback (progress, message)
     * @returns {Promise}
     */
    async function loadMultiple(endpoints, forceRefresh = false, useLocalStorage = false, onProgress) {
        if (!Array.isArray(endpoints)) endpoints = [endpoints];

        // Tentukan endpoint yang benar-benar perlu dimuat
        const needLoad = forceRefresh
            ? endpoints
            : endpoints.filter(ep => !getCachedData(ep));

        const total = needLoad.length;
        if (total === 0) {
            if (onProgress) onProgress(100, 'Semua data sudah tersedia');
            return;
        }

        let loaded = 0;
        const updateProgress = () => {
            loaded++;
            if (onProgress) {
                onProgress(Math.round((loaded / total) * 100), `Memuat ${loaded}/${total}`);
            }
        };

        await Promise.all(needLoad.map(async (ep) => {
            try {
                const data = await apiGet(ep);
                setCachedData(ep, data, useLocalStorage);
            } catch (error) {
                console.error(`❌ Gagal memuat ${ep}:`, error);
                // Simpan array kosong agar UI tidak error
                setCachedData(ep, [], useLocalStorage);
            } finally {
                updateProgress();
            }
        }));
    }

    /**
     * Memuat semua data sekaligus (10 sheet) dengan satu request ke endpoint getAllData.
     * Jika getAllData gagal, fallback ke loadMultiple per-endpoint.
     * @param {boolean} forceRefresh - Abaikan cache
     * @param {function} onProgress - Callback progres (0-100)
     * @param {boolean} useLocalStorage - Simpan ke localStorage
     * @returns {Promise}
     */
    async function loadAllData(forceRefresh = false, onProgress, useLocalStorage = false) {
        // Jika tidak force refresh dan semua data sudah ada di cache, selesai
        if (!forceRefresh && CACHE_KEYS.every(key => getCachedData(key))) {
            if (onProgress) onProgress(100, 'Data sudah tersedia');
            return;
        }

        if (onProgress) onProgress(0, 'Mengambil semua data...');

        try {
            // Coba pakai endpoint getAllData (satu request besar)
            const allData = await apiGetAllData();
            // allData diharapkan berupa objek dengan properti sesuai CACHE_KEYS
            let savedCount = 0;
            CACHE_KEYS.forEach(key => {
                if (allData.hasOwnProperty(key) && allData[key] !== undefined) {
                    setCachedData(key, allData[key], useLocalStorage);
                    savedCount++;
                } else {
                    console.warn(`⚠️ getAllData tidak mengembalikan properti '${key}', menggunakan array kosong.`);
                    setCachedData(key, [], useLocalStorage);
                }
            });
            if (onProgress) onProgress(100, `Selesai (${savedCount} sheet dimuat)`);
        } catch (error) {
            console.error('⚠️ getAllData gagal, fallback ke per-endpoint:', error);
            // Fallback: muat satu per satu
            await loadMultiple(CACHE_KEYS, forceRefresh, useLocalStorage, onProgress);
        }
    }

    /**
     * Mengambil data dari cache
     * @param {string} key - Nama sheet (fitrah, mal, ...)
     * @returns {Array|Object} Data atau array kosong jika tidak ada
     */
    function getData(key) {
        return getCachedData(key) || [];
    }

    /**
     * Menghapus semua cache (sessionStorage dan localStorage)
     */
    function clearCache() {
        CACHE_KEYS.forEach(key => {
            sessionStorage.removeItem('cache_' + key);
            localStorage.removeItem('cache_' + key);
        });
    }

    /**
     * Memeriksa apakah semua data utama sudah ada di cache
     * @returns {boolean}
     */
    function isAllDataLoaded() {
        return CACHE_KEYS.every(key => getCachedData(key));
    }

    // Ekspor ke global
    window.LOADER = {
        loadAllData,
        loadMultiple,
        getData,
        clearCache,
        isAllDataLoaded
    };

    console.log('✅ loader.js (final) loaded. Mode: getAllData + lazy loading.');
})();