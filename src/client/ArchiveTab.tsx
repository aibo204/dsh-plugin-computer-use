/** Computer Use archive policy and private-record management tab. */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  ComputerUseArchiveMode, ComputerUseArchiveRecord, ComputerUseArchiveSettings,
} from '../archive.ts'

export const archiveZh = {
  tab: '电脑操作留档', title: '自动留档', intro: '高风险动作默认保存操作前后截图，仅存放在本机。',
  mode: '留档范围', off: '关闭', highRisk: '仅高风险', allControl: '全部控制动作',
  retention: '保留天数', quota: '空间上限（GB）', autoPin: '高风险记录自动固定',
  records: '留档记录', empty: '暂无留档记录。', clean: '立即清理', refresh: '刷新',
  view: '查看', hide: '收起', pin: '固定', unpin: '取消固定', delete: '删除',
  deleteConfirm: '确定删除这条留档及其截图副本吗？', failed: '操作失败，请稍后重试。',
  before: '操作前', after: '操作后', succeeded: '成功', actionFailed: '失败', bytes: '大小',
} as const

export type ArchiveLocaleKey = keyof typeof archiveZh

export const archiveEn: Record<ArchiveLocaleKey, string> = {
  tab: 'Computer Use archive', title: 'Automatic archive',
  intro: 'High-risk actions keep before-and-after screenshots locally by default.',
  mode: 'Archive scope', off: 'Off', highRisk: 'High risk only', allControl: 'All control actions',
  retention: 'Retention days', quota: 'Storage limit (GB)', autoPin: 'Automatically pin high-risk records',
  records: 'Archive records', empty: 'No archive records yet.', clean: 'Clean now', refresh: 'Refresh',
  view: 'View', hide: 'Hide', pin: 'Pin', unpin: 'Unpin', delete: 'Delete',
  deleteConfirm: 'Delete this archive record and its screenshot copies?', failed: 'The operation failed. Try again.',
  before: 'Before', after: 'After', succeeded: 'Succeeded', actionFailed: 'Failed', bytes: 'Size',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Computer Use archive settings and record actions. */
    'computer-use.archive': ArchiveLocaleKey
  }
}

interface ArchiveTabFace {
  readonly scope: SettingsScope<ComputerUseArchiveSettings>
  readonly remote: Context['remote']['computerUseArchive']
}

type ArchiveTabProps = PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'computer-use.archive'>
  & InjectFace<ArchiveTabFace>

const panel = { display: 'grid', gap: 16, maxWidth: 760 } as const
const controls = { display: 'grid', gap: 12, padding: 16, border: '1px solid var(--ds-border-subtle)', borderRadius: 12 } as const
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 } as const
const list = { display: 'grid', gap: 10, padding: 0, margin: 0, listStyle: 'none' } as const
const card = { display: 'grid', gap: 10, padding: 14, border: '1px solid var(--ds-border-subtle)', borderRadius: 10 } as const
const actions = { display: 'flex', flexWrap: 'wrap', gap: 8 } as const
const images = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 } as const

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Render the settings policy and locally stored evidence records. */
export function ArchiveTab({ scope, remote, t }: ArchiveTabProps) {
  const settings = useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot)
  const [records, setRecords] = useState<readonly ComputerUseArchiveRecord[]>([])
  const [previews, setPreviews] = useState<Readonly<Record<string, readonly { phase: 'before' | 'after'; url: string }[]>>>({})
  const [failed, setFailed] = useState(false)

  const load = async (): Promise<void> => {
    const result = await remote.list()
    if (!result.ok) { setFailed(true); return }
    setFailed(false)
    setRecords(result.value)
  }
  useEffect(() => { void load() }, [])

  const value = settings.value
  if (settings.status !== 'ready' || value === undefined) return null

  const act = async (operation: () => Promise<{ readonly ok: boolean }>): Promise<void> => {
    const result = await operation()
    if (!result.ok) { setFailed(true); return }
    await load()
  }
  const togglePreview = async (record: ComputerUseArchiveRecord): Promise<void> => {
    if (previews[record.id] !== undefined) {
      setPreviews(current => {
        const { [record.id]: removed, ...remaining } = current
        void removed
        return remaining
      })
      return
    }
    const loaded: Array<{ phase: 'before' | 'after'; url: string }> = []
    for (const phase of record.phases) {
      const result = await remote.image(record.id, phase)
      if (!result.ok) { setFailed(true); return }
      loaded.push({ phase, url: `data:${result.value.mediaType};base64,${result.value.data}` })
    }
    setPreviews(current => ({ ...current, [record.id]: loaded }))
  }

  return <section style={panel}>
    <div>
      <h3>{t('title')}</h3>
      <p>{t('intro')}</p>
    </div>
    <div style={controls}>
      <label style={row}>
        <span>{t('mode')}</span>
        <select value={value.archiveMode} disabled={!settings.writable}
          onChange={event => { void scope.set('archiveMode', event.target.value as ComputerUseArchiveMode) }}>
          <option value="off">{t('off')}</option>
          <option value="high-risk">{t('highRisk')}</option>
          <option value="all-control">{t('allControl')}</option>
        </select>
      </label>
      <label style={row}>
        <span>{t('retention')}</span>
        <input type="number" min={1} max={3650} value={value.archiveRetentionDays} disabled={!settings.writable}
          onChange={event => { void scope.set('archiveRetentionDays', Number(event.target.value)) }} />
      </label>
      <label style={row}>
        <span>{t('quota')}</span>
        <input type="number" min={0.001} step={0.1} value={value.archiveMaxBytes / 1_000_000_000} disabled={!settings.writable}
          onChange={event => { void scope.set('archiveMaxBytes', Math.round(Number(event.target.value) * 1_000_000_000)) }} />
      </label>
      <label style={row}>
        <span>{t('autoPin')}</span>
        <input type="checkbox" checked={value.archiveAutoPinHighRisk} disabled={!settings.writable}
          onChange={event => { void scope.set('archiveAutoPinHighRisk', event.target.checked) }} />
      </label>
    </div>
    <div style={row}>
      <h3>{t('records')}</h3>
      <span style={actions}>
        <button type="button" onClick={() => { void act(() => remote.cleanup()) }}>{t('clean')}</button>
        <button type="button" onClick={() => { void load() }}>{t('refresh')}</button>
      </span>
    </div>
    {failed ? <p role="status">{t('failed')}</p> : null}
    {records.length === 0 ? <p>{t('empty')}</p> : <ul style={list}>{records.map(record => <li key={record.id} style={card}>
      <div style={row}>
        <strong>{record.app ?? 'Desktop'} · {record.action}</strong>
        <span>{new Date(record.createdAt).toLocaleString()}</span>
      </div>
      <div>{record.category === undefined ? null : `${record.category} · `}{record.succeeded ? t('succeeded') : t('actionFailed')} · {t('bytes')} {formatBytes(record.bytes)}</div>
      <div style={actions}>
        <button type="button" onClick={() => { void togglePreview(record) }}>{t(previews[record.id] === undefined ? 'view' : 'hide')}</button>
        <button type="button" onClick={() => { void act(() => remote.pin(record.id, !record.pinned)) }}>{t(record.pinned ? 'unpin' : 'pin')}</button>
        <button type="button" onClick={() => {
          if (window.confirm(t('deleteConfirm'))) void act(() => remote.delete(record.id))
        }}>{t('delete')}</button>
      </div>
      {previews[record.id] === undefined ? null : <div style={images}>{previews[record.id]?.map(image => <figure key={image.phase}>
        <img src={image.url} alt={t(image.phase)} style={{ width: '100%', borderRadius: 8 }} />
        <figcaption>{t(image.phase)}</figcaption>
      </figure>)}</div>}
    </li>)}</ul>}
  </section>
}
