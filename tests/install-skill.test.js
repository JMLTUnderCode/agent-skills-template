const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

let degitCalls = [];
let degitBehavior = async () => {};

function resetDegitMock() {
    // Restablece el comportamiento del mock entre pruebas.
    degitCalls = [];
    degitBehavior = async () => {};
}

const degitMock = function degit(source, options) {
    // Captura argumentos y delega en el comportamiento configurado por la prueba.
    degitCalls.push({ source, options });
    return {
        async clone(destination) {
            return degitBehavior(destination, { source, options });
        },
    };
};

require.cache[require.resolve('degit')] = {
    id: require.resolve('degit'),
    filename: require.resolve('degit'),
    loaded: true,
    exports: degitMock,
};

delete require.cache[require.resolve('../lib/install-skill.js')];
const { installSkill } = require('../lib/install-skill.js');

async function createTempDir(prefix) {
    // Crea un directorio temporal aislado para cada prueba.
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('installSkill instala la skill en el directorio final', async () => {
    resetDegitMock();
    degitBehavior = async (destination) => {
        await fs.mkdir(destination, { recursive: true });
        await fs.writeFile(path.join(destination, 'SKILL.md'), 'contenido');
    };

    const targetDir = await createTempDir('install-skill-ok-');
    try {
        await installSkill('python-pro', targetDir, 'main', 'owner/repo');
        const skillFile = path.join(targetDir, 'python-pro', 'SKILL.md');
        assert.equal(fsSync.existsSync(skillFile), true);
        assert.equal(degitCalls.length, 1);
        assert.equal(degitCalls[0].source, 'owner/repo/skills/python-pro#main');
    } finally {
        await fs.rm(targetDir, { recursive: true, force: true });
    }
});

test('installSkill reemplaza una instalación existente', async () => {
    resetDegitMock();
    degitBehavior = async (destination) => {
        await fs.mkdir(destination, { recursive: true });
        await fs.writeFile(path.join(destination, 'SKILL.md'), 'nuevo');
    };

    const targetDir = await createTempDir('install-skill-replace-');
    const existingDir = path.join(targetDir, 'python-pro');
    await fs.mkdir(existingDir, { recursive: true });
    await fs.writeFile(path.join(existingDir, 'old.txt'), 'viejo');

    try {
        await installSkill('python-pro', targetDir);
        assert.equal(fsSync.existsSync(path.join(existingDir, 'old.txt')), false);
        assert.equal(fsSync.existsSync(path.join(existingDir, 'SKILL.md')), true);
    } finally {
        await fs.rm(targetDir, { recursive: true, force: true });
    }
});

test('installSkill limpia temporal y propaga el error cuando degit falla', async () => {
    resetDegitMock();
    degitBehavior = async () => {
        throw new Error('fallo de descarga');
    };

    const targetDir = await createTempDir('install-skill-fail-');
    try {
        await assert.rejects(() => installSkill('python-pro', targetDir), /fallo de descarga/);
        const entries = await fs.readdir(targetDir);
        const hasTemp = entries.some((entry) => entry.startsWith('.__tmp_python-pro_'));
        assert.equal(hasTemp, false);
    } finally {
        await fs.rm(targetDir, { recursive: true, force: true });
    }
});
