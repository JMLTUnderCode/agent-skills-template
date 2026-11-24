# Guía del instalador de skills

Este documento describe el comportamiento detallado del instalador incluido en `agent-skills-template`.

## Prerrequisitos

- Node.js >= 18
- pnpm >= 10 (recomendado)
- Git
- Acceso a internet para descargar el manifest y las skills

> Se recomienda pnpm: el repositorio incluye `pnpm-lock.yaml` y la verificación oficial usa pnpm. Si prefieres npm, puedes usar comandos equivalentes, pero la compatibilidad no está verificada.

## Uso

```bash
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
9. Ofrece cleanup opcional.

## Política de conflictos

Cuando una skill ya existe en un destino seleccionado:

- **Sobrescribir todas**: reemplaza la carpeta de la skill en los destinos seleccionados.
- **Omitir existentes**: conserva la instalación actual.
- **Decidir una por una**: pregunta por cada skill en conflicto; la decisión se aplica a los destinos seleccionados donde exista.
- **Cancelar**: detiene la instalación.

En `scope=both`, la misma política se aplica a global y local.

## Modo no interactivo

Ejemplo:

```bash
pnpm run setup -- --agent claude --scope both --skills python-pro,test-master --skip-existing
```

Si hay conflictos en modo no interactivo, debes pasar `--overwrite` o `--skip-existing`; de lo contrario el instalador termina con error.

## Cleanup

El cleanup elimina artefactos del instalador: `install.js`, `lib/`, `SKILLS_INSTALLER.md`, `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `node_modules`. Conserva `AGENTS.md`, `CONTEXTO.md` y las carpetas de skills instaladas.

## Verificación de desarrollo

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
