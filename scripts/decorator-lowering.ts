import ts from 'typescript'

/** Lower standard Remote decorators for runtimes that do not parse decorator syntax. */
export function decoratorLowering() {
  return {
    name: 'computer-use-typert-decorator-lowering',
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0] ?? id
      if (!/\.[cm]?tsx?$/.test(file) || !/@Remote\b/u.test(code)) return undefined
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        ...(result.sourceMapText === undefined ? {} : { map: result.sourceMapText }),
      }
    },
  }
}
