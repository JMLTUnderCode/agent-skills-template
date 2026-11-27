const os = require('node:os');
const path = require('node:path');

const home = os.homedir();
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const agents = [
    {
        id: 'claude',
        label: 'Claude Code',
        global: path.join(home, '.claude', 'skills'),
        local: '.claude/skills',
    },
    {
        id: 'opencode',
        label: 'OpenCode',
        global: path.join(home, '.config', 'opencode', 'skills'),
        local: '.opencode/skills',
    },
    {
        id: 'gemini',
        label: 'Gemini CLI',
        global: path.join(home, '.gemini', 'skills'),
        local: '.gemini/skills',
    },
    {
        id: 'cursor',
        label: 'Cursor',
        global: path.join(home, '.cursor', 'skills'),
        local: '.cursor/skills',
    },
    {
        id: 'copilot',
        label: 'VS Code Copilot',
        global: path.join(home, '.copilot', 'skills'),
        local: '.github/copilot/skills',
    },
    {
        id: 'codex',
        label: 'Codex',
        global: path.join(home, '.codex', 'skills'),
        local: '.codex/skills',
    },
    {
        id: 'windsurf',
        label: 'Windsurf',
        global: path.join(home, '.codeium', 'windsurf', 'skills'),
        local: '.windsurf/skills',
    },
    {
        id: 'antigravity',
        label: 'Antigravity',
        global: path.join(home, '.gemini', 'antigravity', 'skills'),
        local: '.gemini/antigravity/skills',
    },
];

/**
 * Descripción: Busca un agente soportado por su identificador.
 * Args:
 *    - id: (Obligatorio) Identificador del agente.
 * Returns:
 *    Objeto del agente encontrado o undefined si no existe.
 */
function getAgent(id) {
    // Busca por coincidencia exacta para evitar selecciones ambiguas.
    return agents.find((agent) => agent.id === id);
}

/**
 * Descripción: Resuelve la ruta absoluta de instalación para un agente y alcance.
 * Args:
 *    - agent: (Obligatorio) Objeto de agente con rutas global y local.
 *    - scope: (Obligatorio) Alcance de instalación: global o local.
 * Returns:
 *    Ruta absoluta del directorio destino.
 */
function resolveTarget(agent, scope) {
    // Selecciona la ruta configurada según el alcance solicitado.
    if (scope === 'global') return agent.global;
    return path.resolve(PROJECT_ROOT, agent.local);
}

/**
 * Descripción: Formatea una ruta para mostrarla al usuario de forma legible.
 * Args:
 *    - agent: (Obligatorio) Objeto de agente con rutas global y local.
 *    - scope: (Obligatorio) Alcance de instalación: global o local.
 * Returns:
 *    Ruta legible para mostrar en consola.
 */
function displayPath(agent, scope) {
    // Usa tilde para rutas globales dentro del home del usuario.
    if (scope === 'global') {
        return agent.global.replace(home, '~');
    }
    return `./${agent.local.replace(/^\.\//, '')}`;
}

/**
 * Descripción: Convierte el alcance seleccionado en la lista de destinos a procesar.
 * Args:
 *    - agent: (Obligatorio) Objeto de agente seleccionado; se mantiene por consistencia de API.
 *    - scope: (Obligatorio) Alcance de instalación: global, local o both.
 * Returns:
 *    Lista de alcances concretos a instalar.
 */
function targetsForScope(_agent, scope) {
    // Expande el alcance combinado en destinos concretos.
    if (scope === 'both') return ['global', 'local'];
    return [scope];
}

module.exports = {
    agents,
    getAgent,
    resolveTarget,
    displayPath,
    targetsForScope,
    PROJECT_ROOT,
};
