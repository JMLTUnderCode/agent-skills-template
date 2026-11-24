const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchManifest } = require('../lib/fetch-manifest');

function createJsonResponse(body, ok = true, status = 200, statusText = 'OK') {
    // Construye una respuesta mínima compatible con la API fetch.
    return {
        ok,
        status,
        statusText,
        async json() {
            return body;
        },
    };
}

test('fetchManifest descarga y valida un manifest correcto', async () => {
    // Simula una respuesta HTTP exitosa con estructura válida.
    const originalFetch = global.fetch;
    global.fetch = async () => createJsonResponse({ skills: [{ id: 'python-pro' }] });
    try {
        const manifest = await fetchManifest('https://example.test/manifest.json', 1000);
        assert.equal(manifest.skills.length, 1);
        assert.equal(manifest.skills[0].id, 'python-pro');
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchManifest falla ante respuesta HTTP no exitosa', async () => {
    // Verifica el error explícito cuando el servidor responde con fallo.
    const originalFetch = global.fetch;
    global.fetch = async () => createJsonResponse({}, false, 500, 'Server Error');
    try {
        await assert.rejects(
            () => fetchManifest('https://example.test/manifest.json', 1000),
            /No se pudo descargar el manifest \(500 Server Error\)/
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchManifest falla con manifest inválido', async () => {
    // Protege el flujo ante payloads sin la propiedad skills.
    const originalFetch = global.fetch;
    global.fetch = async () => createJsonResponse({ version: 1 });
    try {
        await assert.rejects(
            () => fetchManifest('https://example.test/manifest.json', 1000),
            /Manifest inválido/
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchManifest reporta timeout por AbortError', async () => {
    // Fuerza un aborto para comprobar el mensaje de timeout.
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
        });
    try {
        await assert.rejects(
            () => fetchManifest('https://example.test/manifest.json', 5),
            /Timeout descargando manifest/
        );
    } finally {
        global.fetch = originalFetch;
    }
});
