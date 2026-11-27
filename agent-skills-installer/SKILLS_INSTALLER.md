# Guía del instalador de skills

Documentación del instalador incluido en `agent-skills-installer/`.

## Prerrequisitos

- Node.js >= 18
- pnpm >= 10 (recomendado)
- Git
- Acceso a internet para descargar el manifest y las skills

> Se recomienda pnpm: el directorio incluye `pnpm-lock.yaml` y la verificación oficial usa pnpm.

## Uso

Ejecuta desde la carpeta del instalador:

```bash
cd agent-skills-installer
pnpm install
pnpm run setup
```

## Flujo interactivo

1. Descarga `manifest.json` desde `skills-hub`.
2. Solicita el agente.
3. Solicita el alcance: `global`, `local` o `both`. Se recomienda `global`.
4. Muestra los destinos efectivos.
5. Permite seleccionar skills agrupadas por categoría.
6. Detecta conflictos por destino y aplica la política elegida.
7. Instala skills secuencialmente.
8. Muestra resumen final (instaladas, omitidas, fallidas).
9. Ofrece limpieza opcional de `node_modules` dentro de `agent-skills-installer/`.

## Alcance de instalación

| Agente          | Global (recomendado)           | Local (raíz del proyecto)      |
| --------------- | ------------------------------ | ------------------------------ |
| Claude Code     | `~/.claude/skills`             | `./.claude/skills`             |
| OpenCode        | `~/.config/opencode/skills`    | `./.opencode/skills`           |
| Gemini CLI      | `~/.gemini/skills`             | `./.gemini/skills`             |
| Cursor          | `~/.cursor/skills`             | `./.cursor/skills`             |
| VS Code Copilot | `~/.copilot/skills`            | `./.github/copilot/skills`     |
| Codex           | `~/.codex/skills`              | `./.codex/skills`              |
| Windsurf        | `~/.codeium/windsurf/skills`   | `./.windsurf/skills`           |
| Antigravity     | `~/.gemini/antigravity/skills` | `./.gemini/antigravity/skills` |

El alcance `local` se resuelve desde la raíz del proyecto (carpeta padre de `agent-skills-installer/`), aunque el comando se ejecute dentro de `agent-skills-installer/`.

## Política de conflictos

Cuando una skill ya existe en un destino seleccionado:

- **Sobrescribir todas**: reemplaza la carpeta de la skill en los destinos seleccionados.
- **Omitir existentes**: conserva la instalación actual.
- **Decidir una por una**: pregunta por cada skill en conflicto; la decisión se aplica a los destinos seleccionados donde exista.
- **Cancelar**: detiene la instalación.

En `scope=both`, la misma política se aplica a global y local. En modo no interactivo, si hay conflictos debes pasar `--overwrite` o `--skip-existing`.

## Modo no interactivo

Ejecuta desde `agent-skills-installer/`:

```bash
pnpm run setup -- --agent opencode --scope global --skills python-pro,typescript-pro --overwrite
```

| Flag              | Descripción                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `--agent`         | ID del agente (`claude`, `opencode`, `gemini`, `cursor`, `copilot`, `codex`, `windsurf`, `antigravity`) |
| `--scope`         | `global`, `local` o `both`                                                                              |
| `--skills`        | Lista CSV de skill IDs                                                                                  |
| `--ref`           | Rama/tag de `skills-hub` (default `main`)                                                               |
| `--overwrite`     | Sobrescribe skills existentes                                                                           |
| `--skip-existing` | Omite skills existentes                                                                                 |
| `--cleanup`       | Elimina `node_modules` dentro de `agent-skills-installer/`                                              |
| `--yes`           | Confirma la limpieza en modo no interactivo                                                             |

## Limpieza opcional

La limpieza solo elimina `node_modules` dentro de `agent-skills-installer/`. No elimina `install.js`, `lib/`, skills instaladas, `AGENTS.md` ni `CONTEXTO.md`.

Si aceptas la limpieza, para volver a usar el instalador debes ejecutar:

```bash
cd agent-skills-installer
pnpm install
pnpm run setup
```

## Reinstalar o agregar skills después

El instalador se mantiene en `agent-skills-installer/`. Para agregar más skills más adelante, vuelve a ejecutar `pnpm run setup` desde esa carpeta. Si eliminaste `node_modules`, ejecuta antes `pnpm install`.

## Variables de entorno

| Variable                  | Propósito                   | Default                                              |
| ------------------------- | --------------------------- | ---------------------------------------------------- |
| `SKILLS_HUB_REPO`         | Repo fuente para `degit`    | `JMLTUnderCode/skills-hub`                           |
| `SKILLS_HUB_MANIFEST_URL` | URL del manifest            | raw de `JMLTUnderCode/skills-hub/main/manifest.json` |
| `GITHUB_TOKEN`            | Acceso si el hub es privado | —                                                    |

## Verificación de desarrollo

Ejecuta desde `agent-skills-installer/`:

```bash
pnpm run check
pnpm run check:fix
pnpm test
```

## Troubleshooting

- **Manifest no descarga**: revisa conexión, proxy o `SKILLS_HUB_MANIFEST_URL`.
- **Skill desconocida**: el ID no existe en `manifest.json`; verifica `--skills`.
- **Errores con degit/GitHub**: revisa Git, acceso al repo, o configura `GITHUB_TOKEN` si el hub es privado.
- **Permisos en ruta global**: ejecuta con permisos adecuados o usa `scope=local`.
- **Skill no aparece en el agente**: confirma la ruta global/local correcta y reinicia/recarga el agente si aplica.
