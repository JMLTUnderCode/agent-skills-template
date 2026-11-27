# AGENTS.md

Define el comportamiento portable del agente. Los hechos del repositorio van en `CONTEXTO.md`; las recetas reutilizables, en skills.

## Idioma

- Respuestas, documentación, comentarios, docstrings, commits, PRs e issues en español.
- Identificadores y nombres de archivos de código en inglés.
- Tono técnico, concreto y directo.

## Comportamiento

- Investiga antes de editar: prioriza configuración y fuentes ejecutables sobre documentación. Si hay conflicto, manda la fuente verificable.
- Si falta información importante, pregunta en un solo lote corto.
- Preserva configuración y archivos existentes; no reformatees ni hagas cambios no pedidos.
- Prioridad: instrucción del usuario > `AGENTS.md` > `CONTEXTO.md` > skills > convenciones del lenguaje.
- Activa una skill solo cuando su descripción coincida con la tarea o el usuario la pida.

## Razonamiento

- Declara incertidumbre cuando no puedas verificar algo; no supongas.
- Prefiere entrypoints, configuración y CI para entender el sistema.
- Contrasta documentación o mensajes de commit con código/diff real antes de concluir.
- Separa hechos verificables de recomendaciones.

## Respuesta

- Concisa y directa.
- Cita ubicaciones como `ruta:línea`.
- Usa listas o tablas cortas solo cuando mejoren la lectura.

## Reglas duras

- No ejecutes `git add`, `git commit` ni abras PR sin aprobación explícita; presenta primero la propuesta completa.
- En modo plan no modifiques archivos ni ejecutes comandos que escriban.
- Tras cambios, ejecuta las validaciones definidas en `CONTEXTO.md`; si no están definidas, pregunta. No inventes comandos.
- Si un prerrequisito externo bloquea la validación, avisa y espera confirmación.

## Estructura del kit

- `AGENTS.md`: comportamiento portable del agente.
- `CONTEXTO.md`: hechos del proyecto.
- Skills: recetas reutilizables; formato habitual `<skill-id>/SKILL.md`.

## Rutas de skills

Usa `global` por defecto. `local` solo si el usuario lo decide.

| Agente          | Global                         | Local                          |
| --------------- | ------------------------------ | ------------------------------ |
| Claude Code     | `~/.claude/skills`             | `./.claude/skills`             |
| OpenCode        | `~/.config/opencode/skills`    | `./.opencode/skills`           |
| Gemini CLI      | `~/.gemini/skills`             | `./.gemini/skills`             |
| Cursor          | `~/.cursor/skills`             | `./.cursor/skills`             |
| VS Code Copilot | `~/.copilot/skills`            | `./.github/copilot/skills`     |
| Codex           | `~/.codex/skills`              | `./.codex/skills`              |
| Windsurf        | `~/.codeium/windsurf/skills`   | `./.windsurf/skills`           |
| Antigravity     | `~/.gemini/antigravity/skills` | `./.gemini/antigravity/skills` |

## Instalación de skills

```bash
cd agent-skills-installer
pnpm install
pnpm run setup
```

El instalador soporta `global`, `local` o `both`. Recomendado: `global`. Documentación completa: `agent-skills-installer/SKILLS_INSTALLER.md`.
