import { cp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FaceModelEmitter, WorkspaceAnalyzer } from '@deepseek-ai/dsh-typert-generator'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const workspace = join(root, '.typert-work')
const packageRoot = join(workspace, 'packages', 'computer-use')
const protocolRoot = join(workspace, 'packages', 'typert-protocol')

await rm(workspace, { recursive: true, force: true })
await mkdir(join(protocolRoot, 'src'), { recursive: true })
await mkdir(packageRoot, { recursive: true })
try {
  await cp(join(root, 'src'), join(packageRoot, 'src'), { recursive: true })
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  manifest.exports['.'] = './src/index.ts'
  manifest.exports['./archive'] = './src/archive.ts'
  await writeFile(join(packageRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir')
  await writeFile(join(protocolRoot, 'package.json'), `${JSON.stringify({
    name: '@deepseek-ai/dsh-typert-protocol', type: 'module', exports: { '.': './src/index.ts' },
  }, null, 2)}\n`)
  await writeFile(join(protocolRoot, 'src', 'index.ts'), `
import { Service, type Context } from '@deepseek-ai/cordis'
export interface RemoteErrorDetailsMap {}
export interface TypertLookup<Host, Wire> { readonly __host?: Host; readonly __wire?: Wire }
export interface TypertLookupMap {}
export interface TypertContext<Wire> { readonly __wire?: Wire }
export interface TypertContextMap {}
export type RemoteErrorCode = keyof RemoteErrorDetailsMap
export class RemoteError<Code extends RemoteErrorCode = RemoteErrorCode> extends Error {
  constructor(readonly code: Code, message: string, readonly details: RemoteErrorDetailsMap[Code], options?: ErrorOptions) {
    super(message, options)
  }
}
export abstract class TypertRemoteService extends Service {
  protected constructor(ctx: Context, serviceKey: string, _options: { namespace?: string } = {}) { super(ctx, serviceKey) }
}
export function Remote<This extends object, Args extends unknown[], Result>(
  _method: (this: This, ...args: Args) => Result,
  _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
): void {}
export interface TypertRemoteContribution { readonly package: string; readonly descriptors: readonly unknown[] }
`)
  await writeFile(join(workspace, 'tsconfig.base.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      skipLibCheck: true, types: ['node'], allowImportingTsExtensions: true,
      baseUrl: '.', paths: { '@deepseek-ai/dsh-typert-protocol': ['./packages/typert-protocol/src/index.ts'] },
    },
  }, null, 2)}\n`)
  await writeFile(join(packageRoot, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: { composite: true, noEmit: true },
    include: ['src/index.ts', 'src/archive.ts', 'src/invariant.ts'],
  }, null, 2)}\n`)
  await writeFile(join(protocolRoot, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../tsconfig.base.json', compilerOptions: { composite: true, noEmit: true }, include: ['src'],
  }, null, 2)}\n`)
  await writeFile(join(workspace, 'tsconfig.host.json'), `${JSON.stringify({
    extends: './tsconfig.base.json', files: [], references: [
      { path: './packages/typert-protocol' }, { path: './packages/computer-use' },
    ],
  }, null, 2)}\n`)
  const model = new WorkspaceAnalyzer({
    root: workspace, packages: ['@aibo204/dsh-plugin-computer-use'], faces: ['host'],
  }).analyze()
  const face = model.faces[0]
  const packageModel = face?.packages.find(candidate => candidate.name === '@aibo204/dsh-plugin-computer-use')
  const artifact = face === undefined || packageModel === undefined
    ? undefined
    : new FaceModelEmitter(face).emit(packageModel.name)
  if (artifact === undefined || artifact.remote === undefined) {
    throw new Error(`Typert emitted no Host Remote artifact: ${JSON.stringify({
      packages: face?.packages.map(candidate => ({ name: candidate.name, invocations: candidate.invocations.length })),
    })}`)
  }
  await writeFile(join(root, 'lib', 'typert.host.js'), artifact.js)
  await writeFile(join(root, 'lib', 'typert.host.d.ts'), artifact.dts)
  await writeFile(join(root, 'lib', 'typert.remote-client.js'), artifact.remote.js)
  await writeFile(join(root, 'lib', 'typert.remote-client.d.ts'), artifact.remote.dts)
  await writeFile(join(root, 'lib', 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
} finally {
  await rm(workspace, { recursive: true, force: true })
}
