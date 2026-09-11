/** Browser-side Computer Use audit projection for DSH Trajectory. */

import type { Context } from '@deepseek-ai/cordis'
import archiveRemote from '@aibo204/dsh-plugin-computer-use/remote'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ArchiveTab, archiveEn, archiveZh } from './ArchiveTab.tsx'

const PREFIX = 'mcp__computer_use__'

/** Client services that must be ready before audit registration. */
export const inject = [
  'trajectoryToolPresentation', 'uiConversation', 'slots', 'locale', 'remote', 'settingsScope',
]

interface SourceBlock {
  readonly type: string
  readonly content: string
  readonly attachment?: unknown
}

interface ToolProjectionInput {
  readonly toolName: string
  readonly argsRaw: string
  readonly result?: {
    readonly content: readonly unknown[]
    readonly isError: boolean
    readonly error?: { readonly name: string; readonly code: string }
  }
}

interface ToolProjection {
  readonly text?: string
  readonly previewMarkdown?: string | null
  readonly inputDetail?: string | null
  readonly result?: string
  readonly resultPreviewMarkdown?: string | null
  readonly outputDetail?: string | null
  readonly outputBlocks?: readonly SourceBlock[] | null
}

interface ToolPresentationService {
  register(definition: {
    readonly id: string
    project(input: ToolProjectionInput): ToolProjection | null
  }): () => void
}

interface ConversationEvent {
  readonly seq: number
  readonly time: number
  readonly type: string
  readonly data: unknown
}

interface ConversationDefinition {
  readonly kind: string
  readonly target: 'trajectory'
  match(event: ConversationEvent): { readonly id: string; readonly role: 'start' | 'update' } | null
  start(context: unknown, match: { readonly event: ConversationEvent }): ApprovalAuditState
  update(context: { readonly state: ApprovalAuditState }, match: { readonly event: ConversationEvent }): ApprovalAuditState
  buildViewNode(context: {
    readonly key: string
    readonly kind: string
    readonly id: string
    readonly state?: ApprovalAuditState
    readonly start?: { readonly event: ConversationEvent; readonly location: unknown }
  }): unknown
}

interface ConversationService {
  readonly events: { register(definition: ConversationDefinition): () => void }
}

interface ApprovalAsked {
  readonly id: string
  readonly toolName: string
  readonly callId?: string
  readonly reason?: string
}

interface ApprovalAuditState {
  readonly asked: ApprovalAsked
  readonly outcome?: string
  readonly decidedSeq?: number
  readonly decidedTime?: number
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {}
}

function parseArguments(argsRaw: string): Readonly<Record<string, unknown>> {
  try {
    return record(JSON.parse(argsRaw))
  } catch {
    return {}
  }
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function redactedLength(value: unknown): { readonly redacted: true; readonly characters?: number } {
  return typeof value === 'string'
    ? { redacted: true, characters: value.length }
    : { redacted: true }
}

function sanitizedArguments(nativeName: string, args: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const key of ['app', 'element_index', 'direction', 'key', 'x', 'y']) {
    const value = args[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') safe[key] = value
  }
  if (nativeName === 'type_text') safe['text'] = redactedLength(args['text'])
  if (nativeName === 'set_value') safe['value'] = redactedLength(args['value'])
  return safe
}

function operation(nativeName: string): 'observe' | 'control' {
  return nativeName === 'list_apps' || nativeName === 'get_app_state' ? 'observe' : 'control'
}

function imageSourceBlock(value: unknown): SourceBlock | undefined {
  const block = record(value)
  const attachment = record(block['attachment'])
  return block['type'] === 'image' && typeof attachment['attachmentId'] === 'string'
    ? { type: 'image', content: '', attachment: block['attachment'] }
    : undefined
}

function imageAudit(content: readonly unknown[]): { readonly blocks: readonly SourceBlock[]; readonly detail: string } {
  const blocks = content.flatMap((value) => {
    const block = imageSourceBlock(value)
    return block === undefined ? [] : [block]
  })
  const ids = blocks.map(block => record(block.attachment)['attachmentId']).filter(safeString)
  return {
    blocks,
    detail: ids.length === 0
      ? 'No screenshot attachment was recorded.'
      : `Screenshot attachments:\n${ids.map(id => `- ${id}`).join('\n')}`,
  }
}

const AUTOMATIC_SCREENSHOT = /^\[Computer Use automatic screenshot (before action|after action)(?: unavailable: ([A-Z_]+))?\]$/

function actionImageAudit(content: readonly unknown[], isError: boolean): {
  readonly blocks: readonly SourceBlock[]
  readonly detail: string
} {
  const images = imageAudit(content)
  const statuses = content.flatMap((value) => {
    const block = record(value)
    if (block['type'] !== 'text' || typeof block['text'] !== 'string') return []
    const match = AUTOMATIC_SCREENSHOT.exec(block['text'])
    if (match?.[1] === undefined) return []
    return [`${match[1]}: ${match[2] === undefined ? 'captured' : `unavailable (${match[2]})`}`]
  })
  return {
    blocks: images.blocks,
    detail: [
      `Computer Use action ${isError ? 'failed' : 'completed'}.`,
      ...statuses,
      ...(images.blocks.length === 0 ? [] : [images.detail]),
    ].join('\n'),
  }
}

/** Project one Computer Use call without exposing typed text, assigned values, or UI-tree text. */
export function projectComputerUseTool(input: ToolProjectionInput): ToolProjection | null {
  if (!input.toolName.startsWith(PREFIX)) return null
  const nativeName = input.toolName.slice(PREFIX.length)
  const args = parseArguments(input.argsRaw)
  const app = safeString(args['app'])
  const safety = operation(nativeName)
  const summary = [safety, app === undefined ? undefined : `app ${JSON.stringify(app)}`]
    .filter((value): value is string => value !== undefined)
    .join(' · ')
  const result = input.result
  if (result === undefined) {
    return {
      text: `Computer Use · ${nativeName}`,
      previewMarkdown: summary,
      inputDetail: JSON.stringify(sanitizedArguments(nativeName, args), null, 2),
    }
  }
  const status = result.isError ? result.error?.code ?? 'error' : 'completed'
  if (nativeName === 'get_app_state') {
    const images = imageAudit(result.content)
    return {
      text: `Computer Use · ${nativeName}`,
      previewMarkdown: summary,
      inputDetail: JSON.stringify(sanitizedArguments(nativeName, args), null, 2),
      result: status,
      resultPreviewMarkdown: images.blocks.length === 0 ? null : `Screenshot ×${String(images.blocks.length)}`,
      outputDetail: images.detail,
      outputBlocks: images.blocks,
    }
  }
  const actionImages = actionImageAudit(result.content, result.isError)
  return {
    text: `Computer Use · ${nativeName}`,
    previewMarkdown: summary,
    inputDetail: JSON.stringify(sanitizedArguments(nativeName, args), null, 2),
    result: status,
    resultPreviewMarkdown: actionImages.blocks.length === 0
      ? null
      : `Automatic screenshot ×${String(actionImages.blocks.length)}`,
    outputDetail: result.isError
      ? `${result.error?.name ?? 'Error'}: ${result.error?.code ?? 'error'}\n${actionImages.detail}`
      : actionImages.detail,
    outputBlocks: actionImages.blocks,
  }
}

function approvalAsked(value: unknown): ApprovalAsked | undefined {
  const data = record(value)
  const id = safeString(data['id'])
  const toolName = safeString(data['toolName'])
  if (id === undefined || toolName === undefined || !toolName.startsWith(PREFIX)) return undefined
  const callId = safeString(data['callId'])
  const reason = safeString(data['reason'])
  return { id, toolName, ...(callId === undefined ? {} : { callId }), ...(reason === undefined ? {} : { reason }) }
}

function approvalDecision(value: unknown): { readonly id: string; readonly outcome: string } | undefined {
  const data = record(value)
  const id = safeString(data['id'])
  const outcome = safeString(data['outcome'])
  return id === undefined || outcome === undefined ? undefined : { id, outcome }
}

const approvalDefinition: ConversationDefinition = {
  kind: 'computer-use-approval-audit',
  target: 'trajectory',
  match(event) {
    if (event.type === 'approval/asked') {
      const asked = approvalAsked(event.data)
      return asked === undefined ? null : { id: asked.id, role: 'start' }
    }
    if (event.type === 'approval/decided') {
      const decided = approvalDecision(event.data)
      return decided === undefined ? null : { id: decided.id, role: 'update' }
    }
    return null
  },
  start(_context, match) {
    const asked = approvalAsked(match.event.data)
    if (asked === undefined) throw new Error('Computer Use approval audit requires approval/asked')
    return { asked }
  },
  update(context, match) {
    const decided = approvalDecision(match.event.data)
    if (decided === undefined) return context.state
    return { ...context.state, outcome: decided.outcome, decidedSeq: match.event.seq, decidedTime: match.event.time }
  },
  buildViewNode(context) {
    const state = context.state
    const start = context.start
    if (state === undefined || start === undefined) return null
    const callId = `computer-use-approval:${state.asked.id}`
    const nativeName = state.asked.toolName.slice(PREFIX.length)
    const root = state.outcome === undefined
      ? { callId, name: 'Computer Use approval', argsRaw: state.asked.reason ?? nativeName, turn: 0, step: 0, time: start.event.time, subCalls: [] }
      : {
        kind: 'tool-result', seq: state.decidedSeq ?? start.event.seq,
        time: state.decidedTime ?? start.event.time, callId,
        call: { name: 'Computer Use approval', argsRaw: state.asked.reason ?? nativeName },
        callTime: start.event.time,
        content: [{ type: 'text', text: state.outcome }],
        isError: state.outcome !== 'allowed-once', subCalls: [],
      }
    return {
      key: context.key, kind: context.kind, id: context.id,
      target: 'trajectory', anchorSeq: start.event.seq, location: start.location,
      data: { kind: 'tool', root },
    }
  },
}

/** Register Computer Use audit presentation into the active DSH client. */
export async function apply(ctx: Context): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(archiveRemote)
  ctx.effect(() => disposeRemote, 'computer-use: archive Remote')
  ctx.effect(
    () => ctx.locale.register('computer-use.archive', { zh: archiveZh, en: archiveEn }),
    'computer-use: archive dictionaries',
  )
  const archiveScope = ctx.settingsScope.bind<import('../archive.ts').ComputerUseArchiveSettings>({
    namespace: 'computer-use',
  })
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'computer-use-archive',
    order: 20,
    label: () => ctx.locale.bind('computer-use.archive')('tab'),
    locale: 'computer-use.archive',
    inject: () => ({ scope: archiveScope, remote: ctx.remote.computerUseArchive }),
  }, ArchiveTab))
  const presentations = ctx.get('trajectoryToolPresentation') as ToolPresentationService | undefined
  if (presentations === undefined) throw new Error('computer-use: Trajectory Tool presentation service is unavailable')
  presentations.register({ id: 'computer-use', project: projectComputerUseTool })
  const conversation = ctx.get('uiConversation') as ConversationService | undefined
  if (conversation === undefined) throw new Error('computer-use: Conversation service is unavailable')
  conversation.events.register(approvalDefinition)
}
