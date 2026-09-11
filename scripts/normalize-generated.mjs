import { readFile, writeFile } from 'node:fs/promises'

const files = process.argv.slice(2)
if (files.length === 0) throw new Error('normalize-generated: expected at least one generated file')

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const normalized = source.replace(/[\t ]+$/gm, '')
  if (normalized !== source) await writeFile(file, normalized)
}
