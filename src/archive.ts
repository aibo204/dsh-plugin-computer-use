/** Local Computer Use evidence archive and its browser Remote API. */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

/** Which admitted control actions receive a private evidence archive. */
export type ComputerUseArchiveMode = 'off' | 'high-risk' | 'all-control'

/** Mutable archive policy supplied by the settings namespace. */
export interface ComputerUseArchiveSettings {
  /** Action selection policy. */
  archiveMode: ComputerUseArchiveMode
  /** Days an unpinned record remains eligible for retention. */
  archiveRetentionDays: number
  /** Maximum aggregate screenshot bytes across unpinned and pinned records. */
  archiveMaxBytes: number
  /** Keep recognized high-risk records until the user unpins them. */
  archiveAutoPinHighRisk: boolean
}

/** One screenshot copied into a private archive record. */
export interface ComputerUseArchiveImage {
  readonly phase: 'before' | 'after'
  readonly attachment: Extract<ContentBlock, { type: 'image' }>['attachment']
}

/** Input committed after one admitted Computer Use control settles. */
export interface ComputerUseArchiveInput {
  readonly agent: Agent
  readonly callId: string
  readonly app?: string
  readonly action: string
  readonly category?: 'send' | 'delete' | 'purchase' | 'upload'
  readonly succeeded: boolean
  readonly images: readonly ComputerUseArchiveImage[]
}

/** Metadata returned to the settings archive browser. */
export interface ComputerUseArchiveRecord {
  readonly id: string
  readonly sessionId: string
  readonly callId: string
  readonly createdAt: number
  readonly app?: string
  readonly action: string
  readonly category?: 'send' | 'delete' | 'purchase' | 'upload'
  readonly succeeded: boolean
  readonly pinned: boolean
  readonly bytes: number
  readonly phases: readonly ('before' | 'after')[]
}

interface StoredArchiveRecord extends ComputerUseArchiveRecord {
  readonly version: 1
  readonly images: readonly { readonly phase: 'before' | 'after'; readonly file: string; readonly mediaType: string }[]
}

/** Result of an explicit or automatic retention pass. */
export interface ComputerUseArchiveCleanupResult {
  readonly deleted: number
  readonly bytesFreed: number
  readonly remainingBytes: number
}

const ARCHIVE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

function mediaExtension(mediaType: string): string {
  switch (mediaType) {
    case 'image/jpeg': return 'jpg'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    default: return 'png'
  }
}

function parseRecord(value: unknown): StoredArchiveRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  if (row['version'] !== 1 || typeof row['id'] !== 'string' || !ARCHIVE_ID.test(row['id'])) return undefined
  if (typeof row['sessionId'] !== 'string' || typeof row['callId'] !== 'string') return undefined
  if (!Number.isSafeInteger(row['createdAt']) || typeof row['action'] !== 'string') return undefined
  if (typeof row['succeeded'] !== 'boolean' || typeof row['pinned'] !== 'boolean') return undefined
  if (!Number.isSafeInteger(row['bytes']) || (row['bytes'] as number) < 0 || !Array.isArray(row['images'])) return undefined
  const images: Array<{ phase: 'before' | 'after'; file: string; mediaType: string }> = []
  for (const image of row['images']) {
    if (typeof image !== 'object' || image === null || Array.isArray(image)) return undefined
    const entry = image as Record<string, unknown>
    if ((entry['phase'] !== 'before' && entry['phase'] !== 'after')
      || typeof entry['file'] !== 'string' || !/^(before|after)-\d+\.(png|jpg|webp|gif)$/u.test(entry['file'])
      || typeof entry['mediaType'] !== 'string') return undefined
    images.push({ phase: entry['phase'], file: entry['file'], mediaType: entry['mediaType'] })
  }
  const category = row['category']
  if (category !== undefined && category !== 'send' && category !== 'delete'
    && category !== 'purchase' && category !== 'upload') return undefined
  const app = row['app']
  if (app !== undefined && typeof app !== 'string') return undefined
  return {
    version: 1,
    id: row['id'], sessionId: row['sessionId'], callId: row['callId'], createdAt: row['createdAt'] as number,
    action: row['action'], succeeded: row['succeeded'], pinned: row['pinned'], bytes: row['bytes'] as number,
    phases: images.map(image => image.phase), images,
    ...(app === undefined ? {} : { app }),
    ...(category === undefined ? {} : { category }),
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Process-wide private evidence archive shared by Computer Use session instances. */
    computerUseArchive: ComputerUseArchiveService
    /** Host owner of the `computerUseArchive` Remote namespace. */
    computerUseArchiveController: ComputerUseArchiveController
  }
}

/** Atomic local archive with serialized mutation and bounded retention. */
export class ComputerUseArchiveService extends Service {
  /** Absolute private archive root. */
  readonly root: string
  private queue: Promise<void> = Promise.resolve()
  private settings: ComputerUseArchiveSettings

  /** @param ctx - root Host context carrying the attachment provider. */
  constructor(ctx: Context, settings: ComputerUseArchiveSettings, root = join(resolveDshHome(), 'computer-use-archive', 'v1')) {
    super(ctx, 'computerUseArchive')
    this.settings = settings
    this.root = root
  }

  /** Replace the effective retention policy after a settings commit. */
  configure(settings: ComputerUseArchiveSettings): void {
    this.settings = settings
    void this.cleanup().catch((error: unknown) => {
      this.ctx.logger.warn('computer-use: archive cleanup after settings update failed: %s',
        error instanceof Error ? error.message : String(error))
    })
  }

  /** Read the current policy for an Agent-scoped capture decision. */
  policy(): ComputerUseArchiveSettings {
    return this.settings
  }

  /** Commit one action record and enforce retention after publication. */
  archive(input: ComputerUseArchiveInput): Promise<void> {
    return this.serial(async () => {
      if (input.images.length === 0) return
      const attachments = this.ctx.get('attachments')
      if (attachments === undefined) return
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      const id = randomUUID()
      const temporary = join(this.root, `.tmp-${id}`)
      const destination = join(this.root, id)
      await mkdir(temporary, { mode: 0o700 })
      try {
        let bytes = 0
        const images: StoredArchiveRecord['images'][number][] = []
        for (const [index, image] of input.images.entries()) {
          const stored = await attachments.readImage(image.attachment)
          const file = `${image.phase}-${String(index)}.${mediaExtension(stored.ref.mediaType)}`
          await writeFile(join(temporary, file), stored.data, { mode: 0o600 })
          bytes += stored.data.byteLength
          images.push({ phase: image.phase, file, mediaType: stored.ref.mediaType })
        }
        const record: StoredArchiveRecord = {
          version: 1,
          id,
          sessionId: String(input.agent.id),
          callId: input.callId,
          createdAt: Date.now(),
          action: input.action,
          succeeded: input.succeeded,
          pinned: input.category !== undefined && this.settings.archiveAutoPinHighRisk,
          bytes,
          phases: images.map(image => image.phase),
          images,
          ...(input.app === undefined ? {} : { app: input.app }),
          ...(input.category === undefined ? {} : { category: input.category }),
        }
        await writeFile(join(temporary, 'record.json'), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
        await rename(temporary, destination)
      } catch (error) {
        await rm(temporary, { recursive: true, force: true })
        throw error
      }
      await this.cleanupUnlocked()
    })
  }

  /** List newest records first; malformed or partial directories stay invisible. */
  list(): Promise<ComputerUseArchiveRecord[]> {
    return this.serial(async () => (await this.records()).map(({ images: _images, version: _version, ...record }) => record))
  }

  /** Return one archived image as canonical base64 for an on-demand preview. */
  image(id: string, phase: 'before' | 'after'): Promise<{ mediaType: string; data: string }> {
    return this.serial(async () => {
      const record = await this.record(id)
      const image = record.images.find(candidate => candidate.phase === phase)
      if (image === undefined) throw new Error(`archive ${id} has no ${phase} image`)
      return { mediaType: image.mediaType, data: (await readFile(join(this.root, id, image.file))).toString('base64') }
    })
  }

  /** Set or clear one record's retention pin. */
  pin(id: string, pinned: boolean): Promise<ComputerUseArchiveRecord> {
    return this.serial(async () => {
      const current = await this.record(id)
      const next: StoredArchiveRecord = { ...current, pinned }
      const path = join(this.root, id, 'record.json')
      const temporary = `${path}.tmp`
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
      await rename(temporary, path)
      const { images: _images, version: _version, ...record } = next
      return record
    })
  }

  /** Delete one archive record and its private screenshot copies. */
  delete(id: string): Promise<void> {
    return this.serial(async () => {
      await this.record(id)
      await rm(join(this.root, id), { recursive: true, force: true })
    })
  }

  /** Remove expired and over-quota unpinned records. */
  cleanup(): Promise<ComputerUseArchiveCleanupResult> {
    return this.serial(() => this.cleanupUnlocked())
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  private async cleanupUnlocked(): Promise<ComputerUseArchiveCleanupResult> {
    const records = await this.records()
    const cutoff = Date.now() - this.settings.archiveRetentionDays * 86_400_000
    let total = records.reduce((sum, record) => sum + record.bytes, 0)
    let deleted = 0
    let bytesFreed = 0
    for (const record of [...records].reverse()) {
      if (record.pinned) continue
      if (record.createdAt >= cutoff && total <= this.settings.archiveMaxBytes) continue
      await rm(join(this.root, record.id), { recursive: true, force: true })
      total -= record.bytes
      bytesFreed += record.bytes
      deleted += 1
    }
    return { deleted, bytesFreed, remainingBytes: total }
  }

  private async records(): Promise<StoredArchiveRecord[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    })
    const records: StoredArchiveRecord[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !ARCHIVE_ID.test(entry.name)) continue
      const value = await readFile(join(this.root, entry.name, 'record.json'), 'utf8')
        .then(text => JSON.parse(text) as unknown)
        .catch(() => undefined)
      const record = parseRecord(value)
      if (record !== undefined && record.id === entry.name) records.push(record)
    }
    return records.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
  }

  private async record(id: string): Promise<StoredArchiveRecord> {
    this.assertId(id)
    const parsed = parseRecord(JSON.parse(await readFile(join(this.root, id, 'record.json'), 'utf8')))
    if (parsed === undefined || parsed.id !== id) throw new Error(`archive ${id} is invalid`)
    return parsed
  }

  private assertId(id: string): void {
    if (!ARCHIVE_ID.test(id)) throw new Error('archive id is invalid')
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** An archive record or requested phase does not exist. */
    'computer-use-archive/not-found': { readonly id: string }
  }
}

/** Browser Remote adapter for private archive management. */
export class ComputerUseArchiveController extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'computerUseArchiveController', { namespace: 'computerUseArchive' })
  }

  /** @returns newest archive records first. */
  @Remote
  list(): Promise<ComputerUseArchiveRecord[]> {
    return this.ctx.computerUseArchive.list()
  }

  /** @returns one image encoded for a browser data URL. */
  @Remote
  async image(id: string, phase: 'before' | 'after'): Promise<{ mediaType: string; data: string }> {
    try {
      return await this.ctx.computerUseArchive.image(id, phase)
    } catch (error) {
      throw new RemoteError('computer-use-archive/not-found', `archive image ${id}/${phase} was not found`, { id }, { cause: error })
    }
  }

  /** @returns updated record after changing its pin. */
  @Remote
  async pin(id: string, pinned: boolean): Promise<ComputerUseArchiveRecord> {
    try {
      return await this.ctx.computerUseArchive.pin(id, pinned)
    } catch (error) {
      throw new RemoteError('computer-use-archive/not-found', `archive ${id} was not found`, { id }, { cause: error })
    }
  }

  /** Delete one record and its private screenshot copies. */
  @Remote
  async delete(id: string): Promise<void> {
    try {
      await this.ctx.computerUseArchive.delete(id)
    } catch (error) {
      throw new RemoteError('computer-use-archive/not-found', `archive ${id} was not found`, { id }, { cause: error })
    }
  }

  /** @returns counts and bytes from an immediate cleanup pass. */
  @Remote
  cleanup(): Promise<ComputerUseArchiveCleanupResult> {
    return this.ctx.computerUseArchive.cleanup()
  }
}
