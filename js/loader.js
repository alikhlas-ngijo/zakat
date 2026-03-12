// js/loader.js
(function() {
    const CACHE_KEYS = [
        'fitrah', 'mal', 'fidyah', 'mustahik', 'pezakat', 'lokasi_izin', 
        'sesi_absen', 'absen_petugas', 'kategori_mustahik', 'settings'
    ];

    function getCachedData(key) {
        const cached = sessionStorage.getItem('cache_' + key);
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch (e) {
            return null;
        }
    }

    function setCachedData(key, data) {
        sessionStorage.setItem('cache_' + key, JSON.stringify(data));
    }

    function isAllDataLoaded() {
        for (let key of CACHE_KEYS) {
            if (!sessionStorage.getItem('cache_' + key)) return false;
        }
        return true;
    }

    async function loadAllData(forceRefresh = false, onProgress) {
        if (!forceRefresh && isAllDataLoaded()) {
            if (onProgress) onProgress(100, 'Data sudah tersedia');
            return;
        }

        const endpoints = [
            { key: 'fitrah', url: 'fitrah' },
            { key: 'mal', url: 'mal' },
            { key: 'fidyah', url: 'fidyah' },
            { key: 'mustahik', url: 'mustahik' },
            { key: 'pezakat', url: 'pezakat' },
            { key: 'lokasi_izin', url: 'lokasi_izin' },
            { key: 'sesi_absen', url: 'sesi_absen' },
            { key: 'absen_petugas', url: 'absen_petugas' },
            { key: 'kategori_mustahik', url: 'kategori_mustahik' },
            { key: 'settings', url: 'settings' }
        ];

        let loaded = 0;
        const total = endpoints.length;

        const updateProgress = (increment = true) => {
            if (increment) loaded++;
            if (onProgress) {
                onProgress(Math.round((loaded / total) * 100), `Memuat data... (${loaded}/${total})`);
            }
        };

        const promises = endpoints.map(async (ep) => {
            try {
                const data = await apiGet(ep.url);
                setCachedData(ep.key, data);
            } catch (error) {
                console.error(`Gagal memuat ${ep.key}:`, error);
                setCachedData(ep.key, []);
            } finally {
                updateProgress(true);
            }
        });

        await Promise.all(promises);
        if (onProgress) onProgress(100, 'Selesai memuat data');
    }

    function getData(key) {
        return getCachedData(key) || [];
    }

    function clearCache() {
        CACHE_KEYS.forEach(key => sessionStorage.removeItem('cache_' + key));
    }

    window.LOADER = {
        loadAllData,
        getData,
        clearCache,
        isAllDataLoaded
    };
})();