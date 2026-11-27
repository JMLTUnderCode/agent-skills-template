const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const {
    agents,
    getAgent,
    resolveTarget,
    displayPath,
    targetsForScope,
    PROJECT_ROOT,
} = require('../lib/agents');

test('agents expone los 8 agentes soportados con rutas global y local', () => {
    // Verifica el contrato base usado por el instalador y la documentación.
    assert.equal(agents.length, 8);
    for (const agent of agents) {
        assert.ok(agent.id);
        assert.ok(agent.label);
        assert.ok(agent.global);
        assert.ok(agent.local);
    }
});

test('getAgent retorna el agente correcto o undefined', () => {
    // Comprueba búsqueda exitosa y caso inexistente.
    const agent = getAgent('opencode');
    assert.equal(agent.label, 'OpenCode');
    assert.equal(getAgent('unknown-agent'), undefined);
});

test('resolveTarget resuelve rutas globales y locales desde PROJECT_ROOT', () => {
    // Valida que local sea absoluta respecto a la raíz del proyecto y global se conserve absoluta.
    const agent = getAgent('claude');
    const localTarget = resolveTarget(agent, 'local');
    const globalTarget = resolveTarget(agent, 'global');
    assert.equal(localTarget, path.resolve(PROJECT_ROOT, agent.local));
    assert.equal(globalTarget, agent.global);
    assert.equal(PROJECT_ROOT, path.resolve(__dirname, '..', '..'));
});

test('displayPath usa tilde en global y prefijo relativo en local', () => {
    // Asegura representación legible para la consola.
    const agent = getAgent('codex');
    assert.equal(displayPath(agent, 'local'), './.codex/skills');
    assert.equal(displayPath(agent, 'global'), agent.global.replace(os.homedir(), '~'));
});

test('targetsForScope expande correctamente el alcance', () => {
    // Confirma el comportamiento de both como instalación dual.
    const agent = getAgent('cursor');
    assert.deepEqual(targetsForScope(agent, 'global'), ['global']);
    assert.deepEqual(targetsForScope(agent, 'local'), ['local']);
    assert.deepEqual(targetsForScope(agent, 'both'), ['global', 'local']);
});
