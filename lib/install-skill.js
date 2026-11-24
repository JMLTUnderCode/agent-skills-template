const path = require('node:path');
const fs = require('fs-extra');
const degit = require('degit');

const DEFAULT_REPO = process.env.SKILLS_HUB_REPO || 'JMLTUnderCode/skills-hub';

/**
 * Descripción: Instala una skill desde skills-hub en un directorio destino.
 * Args:
 *    - skillId: (Obligatorio) Identificador de la skill a instalar.
 *    - targetDir: (Obligatorio) Directorio base donde se instalará la skill.
 *    - ref: (Opcional) Rama o etiqueta de git a usar; por defecto main.
 *    - repo: (Opcional) Repositorio fuente en formato owner/repo.
 * Returns:
 *    Promesa que se resuelve cuando la skill queda instalada.
 */
async function installSkill(skillId, targetDir, ref = 'main', repo = DEFAULT_REPO) {
    // Garantiza que el directorio destino exista antes de copiar.
    await fs.ensureDir(targetDir);

    // Usa un directorio temporal para evitar instalaciones parciales.
    const temporaryDir = path.join(targetDir, `.__tmp_${skillId}_${Date.now()}`);
    const finalDir = path.join(targetDir, skillId);
    await fs.remove(temporaryDir);

    // Configura degit para descargar solo la carpeta de la skill.
    const emitter = degit(`${repo}/skills/${skillId}#${ref}`, {
        cache: false,
        force: true,
        verbose: false,
    });

    try {
        // Descarga en temporal y reemplaza la instalación final de forma segura.
        await emitter.clone(temporaryDir);
        await fs.remove(finalDir);
        await fs.move(temporaryDir, finalDir);
    } catch (error) {
        // Limpia residuos temporales ante cualquier fallo.
        await fs.remove(temporaryDir);
        throw error;
    }
}

module.exports = {
    installSkill,
    DEFAULT_REPO,
};
