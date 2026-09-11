import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type {
  ImageAttachmentRef, ImageRequestPolicy, RequestImageAttachment, SaveImageAttachment, StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import { ComputerUseArchiveService } from '../src/archive.ts'

const roots: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  while (roots.length > 0) await rm(roots.pop() as string, { recursive: true, force: true })
})

class FixtureAttachments extends AttachmentStore {
  readonly imageLimits = {
    maxImageBytes: 1_000_000, maxImagesPerMessage: 10, maxMessageImageBytes: 10_000_000,
    maxImagePixels: 1_000_000, maxImageDimension: 1_000,
    mediaTypes: ['image/png'] as const,
  }
  constructor(ctx: Context, private readonly bytes: ReadonlyMap<string, Uint8Array>) { super(ctx) }
  validateImage(_input: SaveImageAttachment): Promise<void> { return Promise.resolve() }
  saveImage(_input: SaveImageAttachment): Promise<ImageAttachmentRef> { throw new Error('unused') }
  readImage(ref: ImageAttachmentRef): Promise<StoredImageAttachment> {
    const data = this.bytes.get(String(ref.attachmentId))
    if (data === undefined) throw new Error('missing fixture image')
    return Promise.resolve({ ref, data })
  }
  readImageRequest(_ref: ImageAttachmentRef, _policy: ImageRequestPolicy): Promise<RequestImageAttachment> {
    throw new Error('unused')
  }
}

function image(id: string, bytes: number): { ref: ImageAttachmentRef; data: Uint8Array } {
  return {
    ref: { attachmentId: id as ImageAttachmentRef['attachmentId'], mediaType: 'image/png', bytes, width: 1, height: 1 },
    data: new Uint8Array(bytes).fill(7),
  }
}

async function fixture(maxBytes = 2_000_000_000) {
  const root = await mkdtemp(join(tmpdir(), 'computer-use-archive-'))
  roots.push(root)
  const first = image('sha256:first', 6)
  const second = image('sha256:second', 7)
  const ctx = new Context()
  new FixtureAttachments(ctx, new Map([[String(first.ref.attachmentId), first.data], [String(second.ref.attachmentId), second.data]]))
  const archive = new ComputerUseArchiveService(ctx, {
    archiveMode: 'high-risk', archiveRetentionDays: 7, archiveMaxBytes: maxBytes, archiveAutoPinHighRisk: true,
  }, root)
  return { archive, first, second }
}

describe('ComputerUseArchiveService', () => {
  it('copies before/after evidence, auto-pins high risk, previews, unpins, and deletes', async () => {
    const { archive, first, second } = await fixture()
    await archive.archive({
      agent: { id: 'session-1' } as never, callId: 'call-1', app: 'Browser', action: 'click', category: 'send',
      succeeded: true,
      images: [{ phase: 'before', attachment: first.ref }, { phase: 'after', attachment: second.ref }],
    })

    const [record] = await archive.list()
    expect(record).toMatchObject({ sessionId: 'session-1', app: 'Browser', category: 'send', pinned: true, bytes: 13 })
    await expect(archive.image(record!.id, 'before')).resolves.toEqual({
      mediaType: 'image/png', data: Buffer.from(first.data).toString('base64'),
    })
    await expect(archive.pin(record!.id, false)).resolves.toMatchObject({ pinned: false })
    await archive.delete(record!.id)
    await expect(archive.list()).resolves.toEqual([])
  })

  it('removes expired records and preserves pinned records over quota', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { archive, first, second } = await fixture(8)
    await archive.archive({
      agent: { id: 'session-1' } as never, callId: 'old', action: 'click', succeeded: true,
      images: [{ phase: 'before', attachment: first.ref }],
    })
    vi.setSystemTime(new Date('2026-01-09T00:00:00Z'))
    await archive.archive({
      agent: { id: 'session-1' } as never, callId: 'pinned', action: 'click', category: 'delete', succeeded: true,
      images: [{ phase: 'after', attachment: second.ref }],
    })

    const cleanup = await archive.cleanup()
    expect(cleanup).toEqual({ deleted: 0, bytesFreed: 0, remainingBytes: 7 })
    await expect(archive.list()).resolves.toMatchObject([{ callId: 'pinned', pinned: true }])
  })
})
