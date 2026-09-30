import type { Source } from './agenda'

export type SourceOptions = { scriptsDir: string; macosScriptsDir: string; nycuScriptsDir: string }

/** Find the current user installation instead of hard-coding a cache version. */
export function installedScripts(text: string, name: string): string {
  try {
    const registry = JSON.parse(text) as { plugins?: Record<string, { scope?: string; installPath?: string }[]> }
    const entries = registry.plugins?.[`${name}@zyx1121`]
    const entry = Array.isArray(entries) ? entries.find(item => item.scope === 'user' && typeof item.installPath === 'string') : undefined

    return entry?.installPath ? `${entry.installPath}/scripts` : ''
  } catch {
    return ''
  }
}

/** Explicit domain overrides, then legacy scriptsDir, then installed plugins. */
export function sourceDirs(options: SourceOptions, registry: string): Record<Source, string> {
  const macos = options.macosScriptsDir || options.scriptsDir || installedScripts(registry, 'macos')
  const nycu = options.nycuScriptsDir || options.scriptsDir || installedScripts(registry, 'nycu')

  return { calendar: macos, reminders: macos, e3p: nycu }
}
