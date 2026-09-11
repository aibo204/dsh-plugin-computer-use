/** Computer Use archive policy and private-record management tab. */
import type { Context } from '@deepseek-ai/cordis';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ComputerUseArchiveSettings } from '../archive.ts';
export declare const archiveZh: {
    readonly tab: "电脑操作留档";
    readonly title: "自动留档";
    readonly intro: "高风险动作默认保存操作前后截图，仅存放在本机。";
    readonly mode: "留档范围";
    readonly off: "关闭";
    readonly highRisk: "仅高风险";
    readonly allControl: "全部控制动作";
    readonly retention: "保留天数";
    readonly quota: "空间上限（GB）";
    readonly autoPin: "高风险记录自动固定";
    readonly records: "留档记录";
    readonly empty: "暂无留档记录。";
    readonly clean: "立即清理";
    readonly refresh: "刷新";
    readonly view: "查看";
    readonly hide: "收起";
    readonly pin: "固定";
    readonly unpin: "取消固定";
    readonly delete: "删除";
    readonly deleteConfirm: "确定删除这条留档及其截图副本吗？";
    readonly failed: "操作失败，请稍后重试。";
    readonly before: "操作前";
    readonly after: "操作后";
    readonly succeeded: "成功";
    readonly actionFailed: "失败";
    readonly bytes: "大小";
};
export type ArchiveLocaleKey = keyof typeof archiveZh;
export declare const archiveEn: Record<ArchiveLocaleKey, string>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Computer Use archive settings and record actions. */
        'computer-use.archive': ArchiveLocaleKey;
    }
}
interface ArchiveTabFace {
    readonly scope: SettingsScope<ComputerUseArchiveSettings>;
    readonly remote: Context['remote']['computerUseArchive'];
}
type ArchiveTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'computer-use.archive'> & InjectFace<ArchiveTabFace>;
/** Render the settings policy and locally stored evidence records. */
export declare function ArchiveTab({ scope, remote, t }: ArchiveTabProps): import("react").JSX.Element | null;
export {};
