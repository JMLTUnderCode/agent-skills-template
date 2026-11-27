const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const {
    parseArgs,
    ensureValidScope,
    skillExists,
    parseSkillsCsv,
    findUnknownSkills,
    detectConflicts,
    resolveConflictPolicy,
    shouldSkipTarget,
} = require('../lib/installer-core');

test('parseArgs soporta flags, valores separados y clave=valor', () => {
    // Cubre los formatos de argumentos usados por el instalador.
    const args = parseArgs([
        '--agent',
        'opencode',
        '--scope=both',
        '--skills',
        'a,b',
        '--overwrite',
        '--ref',
        'main',
    ]);
    assert.deepEqual(args, {
        agent: 'opencode',
        scope: 'both',
        skills: 'a,b',
        overwrite: true,
        ref: 'main',
    });
});

test('ensureValidScope acepta solo global, local o both', () => {
    // Evita alcances inválidos antes de ejecutar instalaciones.
    assert.equal(ensureValidScope('global'), true);
    assert.equal(ensureValidScope('local'), true);
    assert.equal(ensureValidScope('both'), true);
    assert.equal(ensureValidScope('invalid'), false);
});

test('skillExists detecta una skill instalada en el destino', async () => {
    // Usa un directorio temporal para comprobar existencia real en disco.
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-exists-'));
    const skillDir = path.join(baseDir, 'python-pro');
    await fs.mkdir(skillDir, { recursive: true });
    try {
        assert.equal(skillExists(baseDir, 'python-pro'), true);
        assert.equal(skillExists(baseDir, 'missing-skill'), false);
    } finally {
        await fs.rm(baseDir, { recursive: true, force: true });
    }
});

test('parseSkillsCsv normaliza la lista de skills', () => {
    // Elimina espacios y entradas vacías de la entrada del usuario.
    assert.deepEqual(parseSkillsCsv('a, b,,c ,'), ['a', 'b', 'c']);
});

test('findUnknownSkills retorna IDs ausentes en el manifest', () => {
    // Protege contra instalaciones de skills inexistentes.
    const manifestSkills = [{ id: 'a' }, { id: 'b' }];
    assert.deepEqual(findUnknownSkills(['a', 'x', 'b', 'y'], manifestSkills), ['x', 'y']);
});

test('detectConflicts identifica conflictos por destino', async () => {
    // Simula conflictos en global y local para la misma skill.
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-conflicts-'));
    const globalDir = path.join(baseDir, 'global');
    const localDir = path.join(baseDir, 'local');
    await fs.mkdir(path.join(globalDir, 'skill-a'), { recursive: true });
    await fs.mkdir(path.join(localDir, 'skill-a'), { recursive: true });
    try {
        const conflicts = detectConflicts(
            ['skill-a', 'skill-b'],
            [
                { scope: 'global', dir: globalDir },
                { scope: 'local', dir: localDir },
            ]
        );
        assert.deepEqual(conflicts, [{ skillId: 'skill-a', targets: ['global', 'local'] }]);
    } finally {
        await fs.rm(baseDir, { recursive: true, force: true });
    }
});

test('resolveConflictPolicy aplica reglas no interactivas e interactivas', async () => {
    // Verifica precedencia de flags y fallo en modo no interactivo.
    assert.equal(await resolveConflictPolicy(false, {}, false, async () => 'one-by-one'), 'none');
    assert.equal(
        await resolveConflictPolicy(true, { overwrite: true }, true, async () => 'skip'),
        'overwrite'
    );
    assert.equal(
        await resolveConflictPolicy(true, { 'skip-existing': true }, true, async () => 'overwrite'),
        'skip'
    );
    await assert.rejects(
        () => resolveConflictPolicy(true, {}, true, async () => 'skip'),
        /Usa --overwrite o --skip-existing/
    );
    assert.equal(
        await resolveConflictPolicy(false, {}, true, async () => 'one-by-one'),
        'one-by-one'
    );
});

test('shouldSkipTarget omite solo cuando existe y la decisión es skip', () => {
    // Garantiza que overwrite no omita y que skip solo aplique en conflicto.
    assert.equal(shouldSkipTarget(true, 'skip'), true);
    assert.equal(shouldSkipTarget(true, 'overwrite'), false);
    assert.equal(shouldSkipTarget(false, 'skip'), false);
});
