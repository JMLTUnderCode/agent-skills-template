#!/usr/bin/env node
const path = require('node:path');
const { createRequire } = require('node:module');
const fs = require('fs-extra');
const p = require('@clack/prompts');
const { agents, getAgent, resolveTarget, displayPath, targetsForScope } = require('./lib/agents');
const { fetchManifest } = require('./lib/fetch-manifest');
const { installSkill } = require('./lib/install-skill');

const _require = createRequire(require.resolve('@clack/prompts'));
const { Prompt, isCancel: coreIsCancel } = _require('@clack/core');
const pc = _require('picocolors');

const unicode = process.platform !== 'win32' ? process.env.TERM !== 'linux' : true;
const s = (c, fallback) => (unicode ? c : fallback);
const S_BAR = s('│', '|');
const S_BAR_END = s('└', '—');
const S_RADIO_ACTIVE = s('●', '>');
const S_RADIO_INACTIVE = s('○', ' ');
const S_CHECKBOX_ACTIVE = s('◻', '[•]');
const S_CHECKBOX_SELECTED = s('◼', '[+]');
const S_CHECKBOX_INACTIVE = s('◻', '[ ]');
const S_STEP_ACTIVE = s('◆', '*');
const S_STEP_SUBMIT = s('◇', 'o');
const S_STEP_CANCEL = s('■', 'x');
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
 * Descripción: Renderiza el símbolo de estado del prompt al estilo clack.
 * Args:
 *    - state: (Obligatorio) Estado actual del prompt.
 * Returns:
 *    Cadena con el símbolo coloreado.
 */
function promptSymbol(state) {
    // Mantiene consistencia visual con los prompts nativos de clack.
    if (state === 'submit') return pc.green(S_STEP_SUBMIT);
    if (state === 'cancel') return pc.red(S_STEP_CANCEL);
    return pc.cyan(S_STEP_ACTIVE);
}

/**
 * Descripción: Limita opciones visibles para evitar desbordar la terminal.
 * Args:
 *    - items: (Obligatorio) Lista de filas renderizadas.
 *    - cursor: (Obligatorio) Índice activo.
 *    - maxItems: (Obligatorio) Máximo de filas visibles.
 * Returns:
 *    Lista de filas visibles.
 */
function limitLines(items, cursor, maxItems) {
    // Aplica ventana deslizante simple alrededor del cursor activo.
    if (items.length <= maxItems) return items;
    let start = 0;
    if (cursor >= start + maxItems - 3) {
        start = Math.max(Math.min(cursor - maxItems + 3, items.length - maxItems), 0);
    }
    if (cursor < start + 2) start = Math.max(cursor - 2, 0);
    const end = Math.min(start + maxItems, items.length);
    const slice = items.slice(start, end);
    if (start > 0) slice[0] = pc.dim('...');
    if (end < items.length) slice[slice.length - 1] = pc.dim('...');
    return slice;
}

/**
 * Descripción: Agrupa las skills del manifest por categoría conservando el orden de aparición.
 * Args:
 *    - skills: (Obligatorio) Lista de skills del manifest.
 * Returns:
 *    Lista de objetos con nombre de categoría y skills asociadas.
 */
function groupSkillsByCategory(skills) {
    const grouped = new Map();
    for (const skill of skills) {
        const category = skill.category || 'Otros';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(skill);
    }
    return Array.from(grouped.entries()).map(([category, categorySkills]) => ({
        category,
        skills: categorySkills,
    }));
}
class SkillSelectPrompt extends Prompt {
    constructor(manifestSkills) {
        super(
            {
                render() {
                    const selected = this.selected || new Set();
                    const rows = this.rows || [];
                    if (this.state === 'submit') {
                        return `${pc.gray(S_BAR)}\n${promptSymbol(this.state)}  Selección de skills\n${pc.gray(S_BAR)}  ${pc.dim(`${selected.size} skill(s) seleccionada(s)`)}`;
                    }
                    if (this.state === 'cancel') {
                        return `${pc.gray(S_BAR)}\n${promptSymbol(this.state)}  Selección de skills\n${pc.gray(S_BAR)}  ${pc.strikethrough(pc.dim('cancelado'))}`;
                    }
                    const title =
                        `${pc.gray(S_BAR)}\n${promptSymbol(this.state)}  Selecciona skills por categoría\n` +
                        `${pc.gray(S_BAR)}  ${pc.dim(`↑↓←→ navegar  |  Espacio marcar  |  Enter guardar`)}\n`;
                    const lines = rows.map((row, index) => {
                        const active = index === this.cursor;
                        if (row.type === 'category') {
                            const count = row.skills.filter((id) => selected.has(id)).length;
                            const pointer = active
                                ? pc.cyan(S_RADIO_ACTIVE)
                                : pc.dim(S_RADIO_INACTIVE);
                            const fold = row.expanded ? pc.dim('▾') : pc.dim('▸');
                            const name = active ? pc.cyan(row.category) : row.category;
                            return `${pc.cyan(S_BAR)}  ${pointer} ${fold} ${name} ${pc.dim(`${count}/${row.skills.length}`)}`;
                        }
                        if (row.type === 'skill') {
                            const isSelected = selected.has(row.skillId);
                            const box = isSelected
                                ? pc.green(S_CHECKBOX_SELECTED)
                                : active
                                  ? pc.cyan(S_CHECKBOX_ACTIVE)
                                  : pc.dim(S_CHECKBOX_INACTIVE);
                            const label = active ? pc.white(row.name) : pc.dim(row.name);
                            const hint = active && row.hint ? pc.dim(` - ${row.hint}`) : '';
                            return `${pc.cyan(S_BAR)}    ${box} ${label}${hint}`;
                        }
                        const pointer = active ? pc.cyan(S_RADIO_ACTIVE) : pc.dim(S_RADIO_INACTIVE);
                        const label = active ? pc.cyan(row.label) : row.label;
                        const hint = row.hint ? pc.dim(` (${row.hint})`) : '';
                        return `${pc.cyan(S_BAR)}  ${pointer} ${label}${hint}`;
                    });
                    const visible = limitLines(lines, this.cursor || 0, 16);
                    const err = this.error
                        ? `\n${pc.yellow(S_BAR_END)}  ${pc.yellow(this.error)}`
                        : '';
                    return `${title}${visible.join('\n')}${err}\n${pc.cyan(S_BAR_END)}\n`;
                },
            },
            false
        );

        this.categories = groupSkillsByCategory(manifestSkills);
        this.expanded = new Set();
        this.selected = new Set();
        this.cursor = 0;
        this.error = '';

        this.on('cursor', (key) => {
            this.error = '';
            const rows = this.rows;
            if (!rows.length) return;
            if (key === 'up') this.cursor = this.cursor === 0 ? rows.length - 1 : this.cursor - 1;
            if (key === 'down') this.cursor = this.cursor === rows.length - 1 ? 0 : this.cursor + 1;
            if (key === 'right') {
                const row = rows[this.cursor];
                if (row?.type === 'category') this.expanded.add(row.category);
            }
            if (key === 'left') {
                const row = rows[this.cursor];
                if (row?.type === 'category' && this.expanded.has(row.category))
                    this.expanded.delete(row.category);
                else if (row?.type === 'skill') {
                    const catIndex = rows.findIndex(
                        (r) => r.type === 'category' && r.category === row.category
                    );
                    if (catIndex >= 0) this.cursor = catIndex;
                }
            }
        });

        this.on('key', (char) => {
            const row = this.rows[this.cursor];
            if (char === ' ' && row?.type === 'skill') {
                if (this.selected.has(row.skillId)) this.selected.delete(row.skillId);
                else this.selected.add(row.skillId);
            }
        });
    }

    get rows() {
        const categories = this.categories || [];
        const expandedSet = this.expanded || new Set();
        const selected = this.selected || new Set();
        const rows = [];
        for (const entry of categories) {
            const expanded = expandedSet.has(entry.category);
            rows.push({
                type: 'category',
                category: entry.category,
                expanded,
                skills: entry.skills.map((skill) => skill.id),
            });
            if (expanded) {
                for (const skill of entry.skills) {
                    rows.push({
                        type: 'skill',
                        category: entry.category,
                        skillId: skill.id,
                        name: skill.name,
                        hint:
                            skill.description.length > 55
                                ? `${skill.description.slice(0, 52)}...`
                                : skill.description,
                    });
                }
            }
        }
        rows.push({
            type: 'action',
            action: 'confirm',
            label: 'Confirmar selección',
            hint: `${selected.size} skill(s)`,
        });
        return rows;
    }

    _handleSubmit() {
        const rows = this.rows;
        const row = rows[this.cursor];
        if (!row) return false;
        if (row.type === 'action' && row.action === 'confirm') {
            if (this.selected.size === 0) {
                this.error = 'Selecciona al menos una skill.';
                this.state = 'active';
                return false;
            }
            this.value = Array.from(this.selected);
            this.state = 'submit';
            return true;
        }
        if (row.type === 'category') {
            if (this.expanded.has(row.category)) this.expanded.delete(row.category);
            else this.expanded.add(row.category);
            this.state = 'active';
            return false;
        }
        if (row.type === 'skill') {
            if (this.selected.has(row.skillId)) this.selected.delete(row.skillId);
            else this.selected.add(row.skillId);
            this.state = 'active';
            return false;
        }
        return false;
    }

    prompt() {
        const orig = this.onKeypress.bind(this);
        this.onKeypress = (char, key) => {
            if (key?.name === 'return') {
                const done = this._handleSubmit();
                if (done) {
                    this.emit('submit', this.value);
                    this.close();
                    return;
                }
                this.state = 'active';
                return;
            }
            if (char === '' || key?.name === 'escape') {
                this.state = 'active';
                return;
            }
            return orig(char, key);
        };
        return Prompt.prototype.prompt.call(this);
    }
}

/**
 * Descripción: Elimina node_modules del instalador tras confirmar la acción con el usuario.
 * Args:
 *    - nonInteractive: (Obligatorio) Indica si la ejecución no permite prompts.
 *    - args: (Obligatorio) Argumentos parseados de CLI.
 * Returns:
 *    Promesa que se resuelve cuando finaliza la decisión de limpieza.
 */
async function maybeNodeModulesCleanup(nonInteractive, args) {
    let shouldCleanup = Boolean(args.cleanup);

    if (!shouldCleanup && !nonInteractive) {
        p.note(
            [
                'Esto solo elimina node_modules dentro de agent-skills-installer/.',
                'No se borra install.js, lib/, ni skills instaladas.',
                'Si luego quieres instalar más skills, primero ejecuta:',
                '  cd agent-skills-installer && pnpm install && pnpm run setup',
            ].join('\n'),
            'Limpieza opcional'
        );
        const answer = await p.confirm({
            message: '¿Eliminar node_modules de agent-skills-installer ahora?',
            initialValue: false,
        });
        if (isCancel(answer) || !answer) return;
        shouldCleanup = true;
    }

    if (!shouldCleanup) return;
    if (nonInteractive && !args.cleanup) return;
    if (nonInteractive && !args.yes) return;

    const nodeModulesDir = path.resolve(__dirname, 'node_modules');
    await fs.remove(nodeModulesDir);
    p.log.success(
        'node_modules eliminado. Para volver a usar el instalador: cd agent-skills-installer && pnpm install && pnpm run setup'
    );
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
            [
                'Se recomienda global: es la ruta interna',
                'esperada por los agentes.',
                'Local instala en el repositorio.',
                'Both instala en global y local.',
            ].join('\n'),
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

    // Obtiene la selección de skills desde CLI o prompt interactivo por categorías.
    let selectedSkillIds = [];
    if (args.skills) {
        selectedSkillIds = parseSkillsCsv(args.skills);
    } else {
        const selectedSkills = await new SkillSelectPrompt(manifest.skills).prompt();
        if (coreIsCancel(selectedSkills) || isCancel(selectedSkills)) {
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
        await maybeNodeModulesCleanup(nonInteractive, args);
    } catch (error) {
        p.log.warn(`Limpieza no completada: ${error.message}`);
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
