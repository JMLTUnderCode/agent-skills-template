# agent-skills-template

Plantilla base para proyectos que usan Agent Skills. Incluye un `AGENTS.md` portátil, un `CONTEXTO.md` agnóstico y un instalador interactivo para descargar skills desde `skills-hub`.

## Requisitos

- Node.js >= 18
- pnpm >= 10 (recomendado)
- Git

> Se recomienda pnpm: el repositorio incluye `pnpm-lock.yaml` y la verificación oficial usa pnpm. Si prefieres npm, puedes usar comandos equivalentes, pero la compatibilidad no está verificada.
>
> Si `pnpm install` falla con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, usa una versión de pnpm que respete `pnpm-workspace.yaml` o ajusta temporalmente la política de madurez de dependencias en tu entorno.

## Uso rápido

1. Crea un repositorio usando este template en GitHub.
2. Clona tu nuevo repositorio.
3. Instala dependencias y ejecuta el instalador:

```bash
pnpm install
pnpm run setup
```

## Qué hace el instalador

- Descarga el `manifest.json` desde `skills-hub`.
- Permite elegir agente.
- Permite elegir alcance de instalación: `global`, `local` o `both`.
- Recomienda `global` por ser la ruta interna esperada por los agentes.
- Permite seleccionar skills por categoría.
- Maneja conflictos con sobrescribir, omitir o decidir una por una.
- Puede limpiar los archivos del instalador al finalizar.

## Alcance de instalación

| Agente          | Global (recomendado)           | Local (convención en repo)     |
| --------------- | ------------------------------ | ------------------------------ |
| Claude Code     | `~/.claude/skills`             | `./.claude/skills`             |
| OpenCode        | `~/.config/opencode/skills`    | `./.opencode/skills`           |
| Gemini CLI      | `~/.gemini/skills`             | `./.gemini/skills`             |
| Cursor          | `~/.cursor/skills`             | `./.cursor/skills`             |
| VS Code Copilot | `~/.copilot/skills`            | `./.github/copilot/skills`     |
| Codex           | `~/.codex/skills`              | `./.codex/skills`              |
| Windsurf        | `~/.codeium/windsurf/skills`   | `./.windsurf/skills`           |
| Antigravity     | `~/.gemini/antigravity/skills` | `./.gemini/antigravity/skills` |

## Modo no interactivo

```bash
pnpm run setup -- --agent opencode --scope global --skills python-pro,typescript-pro --overwrite
```

Flags disponibles:

| Flag              | Descripción                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `--agent`         | ID del agente (`claude`, `opencode`, `gemini`, `cursor`, `copilot`, `codex`, `windsurf`, `antigravity`) |
| `--scope`         | `global`, `local` o `both`                                                                              |
| `--skills`        | Lista CSV de skill IDs                                                                                  |
| `--ref`           | Rama/tag de `skills-hub` (default `main`)                                                               |
| `--overwrite`     | Sobrescribe skills existentes                                                                           |
| `--skip-existing` | Omite skills existentes                                                                                 |
| `--cleanup`       | Elimina artefactos del instalador al terminar                                                           |
| `--yes`           | Confirma acciones automáticas en modo no interactivo                                                    |

## Verificación de código

El repositorio usa Biome para lint y formato.

```bash
pnpm run check
pnpm run check:fix
pnpm test
```

## Variables de entorno

| Variable                  | Propósito                   | Default                                              |
| ------------------------- | --------------------------- | ---------------------------------------------------- |
| `SKILLS_HUB_REPO`         | Repo fuente para `degit`    | `JMLTUnderCode/skills-hub`                           |
| `SKILLS_HUB_MANIFEST_URL` | URL del manifest            | raw de `JMLTUnderCode/skills-hub/main/manifest.json` |
| `GITHUB_TOKEN`            | Acceso si el hub es privado | —                                                    |

## Archivos importantes

- `AGENTS.md`: reglas portables para agentes; no lo modifica el instalador.
- `CONTEXTO.md`: contexto del proyecto; agnóstico al agente; no lo modifica el instalador.
- `biome.json`: configuración de lint/formato.
- `install.js` y `lib/`: lógica del instalador; se pueden eliminar con cleanup.
