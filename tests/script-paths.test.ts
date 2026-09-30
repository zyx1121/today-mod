import { describe, expect, test, tier } from 'claude-code/testing'
import { installedScripts, sourceDirs } from '../hooks/script-paths'

tier('user')

const registry = JSON.stringify({ plugins: {
  'macos@zyx1121': [{ scope: 'project', installPath: '/wrong' }, { scope: 'user', installPath: '/cache/macos/0.2.0' }],
  'nycu@zyx1121': [{ scope: 'user', installPath: '/cache/nycu/0.1.0' }],
} })
const options = { scriptsDir: '', macosScriptsDir: '', nycuScriptsDir: '' }

describe('standalone agenda sources', () => {
  test('resolves current user installs and separates macOS from NYCU', async () => {
    expect(sourceDirs(options, registry)).toEqual({ calendar:'/cache/macos/0.2.0/scripts', reminders:'/cache/macos/0.2.0/scripts', e3p:'/cache/nycu/0.1.0/scripts' })
  })
  test('explicit overrides win without requiring an installed plugin', async () => {
    expect(sourceDirs({ ...options, scriptsDir:'/legacy', nycuScriptsDir:'/nycu/scripts' }, '{}')).toEqual({ calendar:'/legacy', reminders:'/legacy', e3p:'/nycu/scripts' })
  })
  test('missing or invalid registry leaves a source unavailable', async () => {
    expect(installedScripts('invalid', 'macos')).toBe('')
    expect(installedScripts('{"plugins":{}}', 'nycu')).toBe('')
    expect(sourceDirs(options, '{}')).toEqual({ calendar:'', reminders:'', e3p:'' })
  })
})
