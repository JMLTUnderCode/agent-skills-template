#!/usr/bin/env node
const path = require('node:path');
const fs = require('fs-extra');
const p = require('@clack/prompts');
const { agents, getAgent, resolveTarget, displayPath, targetsForScope } = require('./lib/agents');
const { fetchManifest } = require('./lib/fetch-manifest');
const { installSkill } = require('./lib/install-skill');
const {
    parseArgs,
    ensureValidScope,
    skillExists,
    parseSkillsCsv,
    findUnknownSkills,
    detectConflicts,
    resolveConflictPolicy,
    shouldSkipTarget,
} = require('./lib/installer-core');

/**
 * Descripción: Determina si el valor retornado por un prompt corresponde a una cancelación.
 * Args:
 *    - value: (Obligatorio) Valor retornado por el prompt.
 * Returns:
 *    Verdadero si el usuario canceló el prompt.
 */
function isCancel(value) {
    // Delegación al helper de clack para mantener consistencia.
    return p.isCancel(value);
}

/**
 * Descripción: Solicita al usuario la política a aplicar ante conflictos detectados.
 * Args:
 *    Sin argumentos.
 * Returns:
 *    Política seleccionada por el usuario.
 */
async function promptConflictPolicy() {
    // Presenta opciones claras para resolver conflictos en lote.
    const policy = await p.select({
        message: 'Se detectaron skills ya instaladas. ¿Qué hacer?',
        options: [
            {
                value: 'overwrite',
                label: 'Sobrescribir todas',
                hint: 'Reemplaza skills existentes en destinos seleccionados',
            },
            {
                value: 'skip',
                label: 'Omitir existentes',
                hint: 'Conserva las ya instaladas',
            },
            {
                value: 'one-by-one',
                label: 'Decidir una por una',
                hint: 'Pregunta por cada skill en conflicto',
            },
            { value: 'cancel', label: 'Cancelar' },
        ],
    });
    if (isCancel(policy) || policy === 'cancel') {
        throw new Error('Instalación cancelada por el usuario.');
    }
    return policy;
}

/**
 * Descripción: Solicita la decisión para una skill en conflicto cuando la política es individual.
 * Args:
 *    - skillId: (Obligatorio) Identificador de la skill en conflicto.
 *    - conflictTargets: (Obligatorio) Lista de alcances donde existe conflicto.
 * Returns:
 *    Decisión overwrite o skip.
 */
async function resolvePerSkillPolicy(skillId, conflictTargets) {
    // Limita la decisión a acciones seguras y explícitas.
    const choice = await p.select({
        message: `Conflicto para ${skillId} (${conflictTargets.join(', ')}). ¿Qué hacer?`,
        options: [
            { value: 'overwrite', label: 'Sobrescribir' },
            { value: 'skip', label: 'Omitir' },
            { value: 'cancel', label: 'Cancelar' },
        ],
    });
    if (isCancel(choice) || choice === 'cancel') {
        throw new Error('Instalación cancelada por el usuario.');
    }
    return choice;
}

/**
 * Descripción: Elimina artefactos del instalador cuando el usuario lo solicita.
 * Args:
 *    - nonInteractive: (Obligatorio) Indica si la ejecución es no interactiva.
 *    - args: (Obligatorio) Argumentos parseados de CLI.
 * Returns:
 *    Promesa que se resuelve al finalizar la limpieza.
 */
async function maybeCleanup(nonInteractive, args) {
    let doCleanup = Boolean(args.cleanup);
    // En modo interactivo pregunta antes de eliminar archivos.
    if (!doCleanup && !nonInteractive) {
        const answer = await p.confirm({
            message:
                '¿Eliminar archivos del instalador? ' +
                '(se conservan AGENTS.md, CONTEXTO.md y skills instaladas)',
            initialValue: false,
        });
        if (isCancel(answer)) return;
        doCleanup = Boolean(answer);
    }
    if (!doCleanup) return;
    if (nonInteractive && !args.yes && !args.cleanup) return;

    // Conserva archivos de contexto y solo elimina artefactos del instalador.
    const removePaths = [
        'install.js',
        'lib',
        'SKILLS_INSTALLER.md',
        'package.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'node_modules',
    ];
    for (const relativePath of removePaths) {
        await fs.remove(path.resolve(process.cwd(), relativePath));
    }
    p.log.success('Limpieza completada. Conservados AGENTS.md, CONTEXTO.md y skills instaladas.');
}

/**
 * Descripción: Ejecuta el flujo principal del instalador de skills.
 * Args:
 *    Sin argumentos.
 * Returns:
 *    Promesa que se resuelve al completar la instalación o termina el proceso con error.
 */
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const nonInteractive = Boolean(args.agent && args.scope && args.skills);

    p.intro('Agent Skills Template — Instalador');

    // Descarga el manifest antes de solicitar decisiones dependientes del catálogo.
    const manifestSpinner = p.spinner();
    manifestSpinner.start('Descargando manifest de skills-hub');
    let manifest;
    try {
        manifest = await fetchManifest();
        manifestSpinner.stop(`Manifest cargado (${manifest.skills.length} skills)`);
    } catch (error) {
        manifestSpinner.stop('Error descargando manifest');
        p.cancel(error.message);
        process.exit(1);
    }

    // Resuelve el agente objetivo desde CLI o prompt interactivo.
    let agentId = args.agent;
    if (!agentId) {
        const selectedAgent = await p.select({
            message: 'Selecciona el agente',
            options: agents.map((agentOption) => ({
                value: agentOption.id,
                label: agentOption.label,
                hint:
                    `global: ${displayPath(agentOption, 'global')} | ` +
                    `local: ${displayPath(agentOption, 'local')}`,
            })),
        });
        if (isCancel(selectedAgent)) {
            p.cancel('Instalación cancelada.');
            process.exit(1);
        }
        agentId = selectedAgent;
    }

    const agent = getAgent(agentId);
    if (!agent) {
        p.cancel(`Agente inválido: ${agentId}`);
        process.exit(1);
    }

    // Resuelve el alcance de instalación con recomendación global por defecto.
    let scope = args.scope || 'global';
    if (!args.scope && !nonInteractive) {
        p.note(
            'Se recomienda global porque es la ruta interna esperada por los agentes. ' +
                'Local instala en el repositorio; both instala en ambos.',
            'Alcance de instalación'
        );
        const selectedScope = await p.select({
            message: 'Selecciona el alcance de instalación',
            initialValue: 'global',
            options: [
                {
                    value: 'global',
                    label: 'Global (recomendado)',
                    hint: displayPath(agent, 'global'),
                },
                { value: 'local', label: 'Local', hint: displayPath(agent, 'local') },
                {
                    value: 'both',
                    label: 'Ambos',
                    hint: `${displayPath(agent, 'global')} + ${displayPath(agent, 'local')}`,
                },
            ],
        });
        if (isCancel(selectedScope)) {
            p.cancel('Instalación cancelada.');
            process.exit(1);
        }
        scope = selectedScope;
    }

    if (!ensureValidScope(scope)) {
        p.cancel(`Scope inválido: ${scope}. Usa global, local o both.`);
        process.exit(1);
    }

    // Calcula destinos concretos para el alcance seleccionado.
    const scopes = targetsForScope(agent, scope);
    const targets = scopes.map((currentScope) => ({
        scope: currentScope,
        dir: resolveTarget(agent, currentScope),
        display: displayPath(agent, currentScope),
    }));
    p.log.info(
        `Destinos: ${targets.map((target) => `${target.scope}=${target.display}`).join(' | ')}`
    );

    // Obtiene la selección de skills desde CLI o multiselect interactivo.
    let selectedSkillIds = [];
    if (args.skills) {
        selectedSkillIds = parseSkillsCsv(args.skills);
    } else {
        const options = manifest.skills.map((skill) => ({
            value: skill.id,
            label: `[${skill.category}] ${skill.name}`,
            hint:
                skill.description.length > 90
                    ? `${skill.description.slice(0, 87)}...`
                    : skill.description,
        }));
        const selectedSkills = await p.multiselect({
            message: 'Selecciona las skills a instalar',
            required: true,
            options,
        });
        if (isCancel(selectedSkills)) {
            p.cancel('Instalación cancelada.');
            process.exit(1);
        }
        selectedSkillIds = selectedSkills;
    }

    // Valida que todas las skills solicitadas existan en el manifest.
    const unknownSkills = findUnknownSkills(selectedSkillIds, manifest.skills);
    if (unknownSkills.length > 0) {
        p.cancel(`Skills desconocidas en manifest: ${unknownSkills.join(', ')}`);
        process.exit(1);
    }

    // Detecta conflictos y resuelve la política antes de instalar.
    const conflicts = detectConflicts(selectedSkillIds, targets);
    let policy;
    try {
        policy = await resolveConflictPolicy(
            nonInteractive,
            args,
            conflicts.length > 0,
            promptConflictPolicy
        );
    } catch (error) {
        p.cancel(error.message);
        process.exit(1);
    }

    // Pide confirmación final en modo interactivo.
    if (!nonInteractive) {
        const summary = [
            `Agente: ${agent.label}`,
            `Scope: ${scope}`,
            `Destinos: ${targets.map((target) => target.display).join(', ')}`,
            `Skills: ${selectedSkillIds.length}`,
            `Conflictos: ${conflicts.length}`,
            `Política: ${policy}`,
        ].join('\n');
        const confirmed = await p.confirm({
            message: `Confirmar instalación?\n${summary}`,
            initialValue: true,
        });
        if (isCancel(confirmed) || !confirmed) {
            p.cancel('Instalación cancelada.');
            process.exit(1);
        }
    }

    // Instala skills secuencialmente para mantener logs y control de errores claros.
    const ref = args.ref || 'main';
    const results = { installed: [], skipped: [], failed: [] };
    const installSpinner = p.spinner();

    for (const skillId of selectedSkillIds) {
        const conflictTargets = targets
            .filter((target) => skillExists(target.dir, skillId))
            .map((target) => target.scope);

        let decision = policy;
        if (conflictTargets.length > 0 && policy === 'one-by-one') {
            try {
                decision = await resolvePerSkillPolicy(skillId, conflictTargets);
            } catch (error) {
                p.cancel(error.message);
                process.exit(1);
            }
        }

        if (conflictTargets.length > 0 && decision === 'skip') {
            results.skipped.push(skillId);
            p.log.warn(`Omitida: ${skillId}`);
            continue;
        }

        installSpinner.start(`Instalando ${skillId}`);
        let hasError = false;
        for (const target of targets) {
            const exists = skillExists(target.dir, skillId);
            if (shouldSkipTarget(exists, decision)) continue;
            try {
                await installSkill(skillId, target.dir, ref);
            } catch (error) {
                hasError = true;
                results.failed.push({
                    skillId,
                    scope: target.scope,
                    error: error.message,
                });
            }
        }

        if (hasError) {
            installSpinner.stop(`Fallo: ${skillId}`);
        } else {
            installSpinner.stop(`Instalada: ${skillId}`);
            results.installed.push(skillId);
        }
    }

    // Presenta un resumen final para auditoría rápida del resultado.
    const summaryLines = [
        `Instaladas: ${results.installed.length}`,
        `Omitidas: ${results.skipped.length}`,
        `Fallidas: ${results.failed.length}`,
    ];
    if (results.failed.length > 0) {
        summaryLines.push('Detalle de fallos:');
        for (const failure of results.failed) {
            summaryLines.push(`- ${failure.skillId} (${failure.scope}): ${failure.error}`);
        }
    }
    p.note(summaryLines.join('\n'), 'Resumen');

    try {
        await maybeCleanup(nonInteractive, args);
    } catch (error) {
        p.log.warn(`Cleanup no completado: ${error.message}`);
    }

    if (results.failed.length > 0) {
        p.outro('Instalación completada con errores.');
        process.exit(1);
    }
    p.outro('Instalación completada.');
}

main().catch((error) => {
    p.cancel(error?.message ? error.message : String(error));
    process.exit(1);
});
