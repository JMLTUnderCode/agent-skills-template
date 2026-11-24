const DEFAULT_MANIFEST_URL =
    process.env.SKILLS_HUB_MANIFEST_URL ||
    'https://raw.githubusercontent.com/JMLTUnderCode/skills-hub/main/manifest.json';

/**
 * Descripción: Descarga y valida el manifest de skills desde una URL remota.
 * Args:
 *    - url: (Opcional) URL del manifest; usa SKILLS_HUB_MANIFEST_URL o el valor por defecto.
 *    - timeoutMs: (Opcional) Tiempo máximo de espera en milisegundos.
 * Returns:
 *    Objeto manifest parseado y validado.
 */
async function fetchManifest(url = DEFAULT_MANIFEST_URL, timeoutMs = 10000) {
    // Configura un timeout para evitar bloqueos por red.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        // Solicita el manifest con un User-Agent identificable.
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'agent-skills-template' },
        });

        // Falla temprano ante respuestas HTTP no exitosas.
        if (!response.ok) {
            throw new Error(
                `No se pudo descargar el manifest (${response.status} ${response.statusText})`
            );
        }

        // Valida la estructura mínima esperada por el instalador.
        const manifest = await response.json();
        if (!manifest || !Array.isArray(manifest.skills)) {
            throw new Error('Manifest inválido: falta la propiedad "skills"');
        }
        return manifest;
    } catch (error) {
        // Traduce el aborto por timeout a un error más claro para el usuario.
        if (error.name === 'AbortError') {
            throw new Error(`Timeout descargando manifest tras ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        // Libera el temporizador en cualquier resultado.
        clearTimeout(timer);
    }
}

module.exports = {
    fetchManifest,
    DEFAULT_MANIFEST_URL,
};
