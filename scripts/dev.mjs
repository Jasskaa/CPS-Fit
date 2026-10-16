// Arranca next dev fijando la caché del binario SWC dentro del proyecto (necesario en algunos Windows con ACL restringidas).
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, SWC_NATIVE_BINDING_CACHE: resolve(root, '.swc-cache') }
const port = process.env.PORT ?? process.argv[2] ?? '3010'
spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', `--port=${port}`], { stdio: 'inherit', env, cwd: root })
