const path = require('node:path');
const fs = require('fs-extra');

/**
 * Descripción: Convierte los argumentos de CLI en un objeto de opciones.
 * Args:
 *    - argv: (Obligatorio) Lista de argumentos de línea de comandos.
 * Returns:
 *    Objeto con claves y valores parseados.
 */
function parseArgs(argv) {
    const args = {};
    // Recorre argumentos para soportar --clave valor y --clave=valor.
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith('--')) continue;

        const [key, inlineValue] = argument.slice(2).split('=');
        if (inlineValue !== undefined) {
            args[key] = inlineValue;
            continue;
        }

        // Trata flags booleanos conocidos como verdaderos cuando no tienen valor.
        if (['overwrite', 'skip-existing', 'cleanup', 'yes'].includes(key)) {
            args[key] = true;
            continue;
        }

        // Usa el siguiente token como valor cuando no es otra bandera.
        const nextValue = argv[index + 1];
        if (nextValue && !nextValue.startsWith('--')) {
            args[key] = nextValue;
            index += 1;
        } else {
            args[key] = true;
        }
    }
    return args;
}

/**
 * Descripción: Valida que el alcance solicitado sea soportado por el instalador.
 * Args:
 *    - scope: (Obligatorio) Alcance recibido desde CLI o prompt.
 * Returns:
 *    Verdadero si el alcance es válido.
 */
function ensureValidScope(scope) {
    // Limita los alcances a los soportados por la herramienta.
    return ['global', 'local', 'both'].includes(scope);
}

/**
 * Descripción: Determina si una skill ya existe en el directorio destino.
 * Args:
 *    - targetDir: (Obligatorio) Directorio base de instalación.
 *    - skillId: (Obligatorio) Identificador de la skill.
 * Returns:
 *    Verdadero si la carpeta de la skill existe.
 */
function skillExists(targetDir, skillId) {
    // Verifica existencia sincrónica para decisiones rápidas en flujo interactivo.
    return fs.pathExistsSync(path.join(targetDir, skillId));
}

/**
 * Descripción: Normaliza una cadena CSV de skills a una lista limpia de IDs.
 * Args:
 *    - skillsCsv: (Obligatorio) Cadena con IDs separados por coma.
 * Returns:
 *    Lista de IDs sin espacios ni entradas vacías.
 */
function parseSkillsCsv(skillsCsv) {
    // Separa, recorta y elimina entradas vacías para evitar falsos IDs.
    return String(skillsCsv)
        .split(',')
        .map((skillId) => skillId.trim())
        .filter(Boolean);
}

/**
 * Descripción: Filtra los IDs de skills que no están presentes en el manifest.
 * Args:
 *    - selectedSkillIds: (Obligatorio) IDs solicitados por el usuario.
 *    - manifestSkills: (Obligatorio) Lista de skills disponibles en el manifest.
 * Returns:
 *    Lista de IDs desconocidos.
 */
function findUnknownSkills(selectedSkillIds, manifestSkills) {
    // Usa un conjunto para búsquedas rápidas por ID.
    const knownIds = new Set(manifestSkills.map((skill) => skill.id));
    return selectedSkillIds.filter((skillId) => !knownIds.has(skillId));
}

/**
 * Descripción: Detecta conflictos de instalación por skill y destino.
 * Args:
 *    - selectedSkillIds: (Obligatorio) IDs de skills seleccionadas.
 *    - targets: (Obligatorio) Destinos con scope, dir y display.
 * Returns:
 *    Lista de conflictos con skillId y scopes afectados.
 */
function detectConflicts(selectedSkillIds, targets) {
    const conflicts = [];
    // Evalúa cada skill contra todos los destinos seleccionados.
    for (const skillId of selectedSkillIds) {
        const hitTargets = targets
            .filter((target) => skillExists(target.dir, skillId))
            .map((target) => target.scope);
        if (hitTargets.length > 0) {
            conflicts.push({ skillId, targets: hitTargets });
        }
    }
    return conflicts;
}

/**
 * Descripción: Resuelve la política de conflictos según argumentos y modo de ejecución.
 * Args:
 *    - nonInteractive: (Obligatorio) Indica si la ejecución no permite prompts.
 *    - args: (Obligatorio) Argumentos parseados de CLI.
 *    - hasConflicts: (Obligatorio) Indica si existen conflictos detectados.
 *    - promptFn: (Obligatorio) Función async para preguntar política en modo interactivo.
 * Returns:
 *    Política seleccionada: none, overwrite, skip o one-by-one.
 */
async function resolveConflictPolicy(nonInteractive, args, hasConflicts, promptFn) {
    // Evita preguntas cuando no hay conflictos.
    if (!hasConflicts) return 'none';
    if (args.overwrite) return 'overwrite';
    if (args['skip-existing']) return 'skip';
    if (nonInteractive) {
        throw new Error(
            'Hay conflictos de skills existentes. ' +
                'Usa --overwrite o --skip-existing en modo no interactivo.'
        );
    }
    return promptFn();
}

/**
 * Descripción: Determina si un destino debe omitirse por política de conflicto.
 * Args:
 *    - exists: (Obligatorio) Indica si la skill existe en el destino.
 *    - decision: (Obligatorio) Decisión aplicada a la skill.
 * Returns:
 *    Verdadero cuando se debe omitir la instalación en el destino.
 */
function shouldSkipTarget(exists, decision) {
    // Solo omite cuando hay conflicto y la decisión es skip.
    return exists && decision === 'skip';
}

module.exports = {
    parseArgs,
    ensureValidScope,
    skillExists,
    parseSkillsCsv,
    findUnknownSkills,
    detectConflicts,
    resolveConflictPolicy,
    shouldSkipTarget,
};
