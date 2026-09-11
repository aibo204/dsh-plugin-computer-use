import { describe, expect, it } from 'vitest'
import { apply, inject, projectComputerUseTool } from '../src/client/index.ts'

describe('Computer Use client audit projection', () => {
  it('waits for both audit registries before activation', () => {
    expect(inject).toEqual([
      'trajectoryToolPresentation', 'uiConversation', 'slots', 'locale', 'remote', 'settingsScope',
    ])
  })

  it('redacts typed text from running and settled records', () => {
    const running = projectComputerUseTool({
      toolName: 'mcp__computer_use__type_text',
      argsRaw: '{"app":"Notes","element_index":4,"text":"top secret"}',
    })
    expect(running).toMatchObject({
      text: 'Computer Use · type_text',
      previewMarkdown: 'control · app "Notes"',
    })
    expect(running?.inputDetail).toContain('"characters": 10')
    expect(JSON.stringify(running)).not.toContain('top secret')

    const settled = projectComputerUseTool({
      toolName: 'mcp__computer_use__type_text',
      argsRaw: '{"app":"Notes","text":"top secret"}',
      result: { content: [{ type: 'text', text: 'echoed top secret' }], isError: false },
    })
    expect(settled).toMatchObject({ result: 'completed', outputDetail: 'Computer Use action completed.', outputBlocks: [] })
    expect(JSON.stringify(settled)).not.toContain('top secret')
  })

  it('keeps screenshot attachment ids and removes the accessibility-tree text', () => {
    const projected = projectComputerUseTool({
      toolName: 'mcp__computer_use__get_app_state',
      argsRaw: '{"app":"Safari"}',
      result: {
        isError: false,
        content: [
          { type: 'text', text: 'sensitive page text' },
          { type: 'image', attachment: { attachmentId: 'sha256:abc', mediaType: 'image/png' } },
        ],
      },
    })
    expect(projected).toMatchObject({
      result: 'completed', resultPreviewMarkdown: 'Screenshot ×1',
      outputDetail: 'Screenshot attachments:\n- sha256:abc',
      outputBlocks: [{ type: 'image', attachment: { attachmentId: 'sha256:abc' } }],
    })
    expect(JSON.stringify(projected)).not.toContain('sensitive page text')
  })

  it('keeps automatic action screenshots and only their safe capture diagnostics', () => {
    const projected = projectComputerUseTool({
      toolName: 'mcp__computer_use__click',
      argsRaw: '{"app":"Safari","element_index":2}',
      result: {
        isError: false,
        content: [
          { type: 'text', text: 'sensitive action output' },
          { type: 'text', text: '[Computer Use automatic screenshot before action]' },
          { type: 'image', attachment: { attachmentId: 'sha256:before', mediaType: 'image/png' } },
          { type: 'text', text: '[Computer Use automatic screenshot after action unavailable: CAPTURE_TIMEOUT]' },
        ],
      },
    })

    expect(projected).toMatchObject({
      result: 'completed',
      resultPreviewMarkdown: 'Automatic screenshot ×1',
      outputBlocks: [{ type: 'image', attachment: { attachmentId: 'sha256:before' } }],
    })
    expect(projected?.outputDetail).toContain('before action: captured')
    expect(projected?.outputDetail).toContain('after action: unavailable (CAPTURE_TIMEOUT)')
    expect(JSON.stringify(projected)).not.toContain('sensitive action output')
  })

  it('keeps automatic screenshots when the controlling action fails', () => {
    const projected = projectComputerUseTool({
      toolName: 'mcp__computer_use__click',
      argsRaw: '{"app":"Safari","element_index":2}',
      result: {
        isError: true,
        error: { name: 'ActionError', code: 'CLICK_FAILED' },
        content: [
          { type: 'text', text: '[Computer Use automatic screenshot after action]' },
          { type: 'image', attachment: { attachmentId: 'sha256:failed', mediaType: 'image/png' } },
        ],
      },
    })

    expect(projected).toMatchObject({
      result: 'CLICK_FAILED',
      outputBlocks: [{ type: 'image', attachment: { attachmentId: 'sha256:failed' } }],
    })
    expect(projected?.outputDetail).toContain('ActionError: CLICK_FAILED')
    expect(projected?.outputDetail).toContain('Computer Use action failed.')
    expect(projected?.outputDetail).toContain('after action: captured')
  })

  it('delegates unrelated tools', () => {
    expect(projectComputerUseTool({ toolName: 'bash', argsRaw: '{}' })).toBeNull()
  })
})

describe('Computer Use approval audit', () => {
  it('pairs durable approval events into one timed trajectory Tool record', async () => {
    let definition: {
      match(event: unknown): { id: string; role: 'start' | 'update' } | null
      start(context: unknown, match: { event: unknown }): unknown
      update(context: { state: unknown }, match: { event: unknown }): unknown
      buildViewNode(context: unknown): unknown
    } | undefined
    const ctx = {
      remote: {
        $mount: () => Promise.resolve(() => Promise.resolve()),
        computerUseArchive: {},
      },
      effect: (_effect: () => unknown) => () => undefined,
      locale: { register: () => () => undefined, bind: () => (key: string) => key },
      settingsScope: { bind: () => ({}) },
      slots: {
        inject: (_name: string, register: () => unknown) => { register(); return () => undefined },
        register: () => () => undefined,
      },
      get(name: string) {
        if (name === 'trajectoryToolPresentation') return { register: () => () => {} }
        if (name === 'uiConversation') {
          return { events: { register: (value: typeof definition) => { definition = value; return () => {} } } }
        }
        return undefined
      },
    }
    await apply(ctx as never)
    if (definition === undefined) throw new Error('definition was not registered')
    const asked = {
      seq: 10, time: 1_000, type: 'approval/asked',
      data: {
        id: 'approval-1', toolName: 'mcp__computer_use__click', callId: 'call-1',
        reason: 'Allow Computer Use to control app "Safari" using click (element 2)?',
      },
    }
    const decided = {
      seq: 11, time: 1_250, type: 'approval/decided',
      data: { id: 'approval-1', outcome: 'allowed-once' },
    }
    expect(definition.match(asked)).toEqual({ id: 'approval-1', role: 'start' })
    expect(definition.match(decided)).toEqual({ id: 'approval-1', role: 'update' })
    const initial = definition.start({}, { event: asked })
    const state = definition.update({ state: initial }, { event: decided })
    expect(definition.buildViewNode({
      key: 'approval', kind: 'computer-use-approval-audit', id: 'approval-1', state,
      start: { event: asked, location: { kind: 'step' } },
    })).toMatchObject({
      target: 'trajectory', anchorSeq: 10,
      data: { kind: 'tool', root: {
        kind: 'tool-result', callId: 'computer-use-approval:approval-1',
        callTime: 1_000, time: 1_250, content: [{ type: 'text', text: 'allowed-once' }],
        isError: false,
      } },
    })
  })
})
