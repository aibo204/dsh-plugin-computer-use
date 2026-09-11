/** Browser-side Computer Use audit projection for DSH Trajectory. */
import type { Context } from '@deepseek-ai/cordis';
/** Client services that must be ready before audit registration. */
export declare const inject: string[];
interface SourceBlock {
    readonly type: string;
    readonly content: string;
    readonly attachment?: unknown;
}
interface ToolProjectionInput {
    readonly toolName: string;
    readonly argsRaw: string;
    readonly result?: {
        readonly content: readonly unknown[];
        readonly isError: boolean;
        readonly error?: {
            readonly name: string;
            readonly code: string;
        };
    };
}
interface ToolProjection {
    readonly text?: string;
    readonly previewMarkdown?: string | null;
    readonly inputDetail?: string | null;
    readonly result?: string;
    readonly resultPreviewMarkdown?: string | null;
    readonly outputDetail?: string | null;
    readonly outputBlocks?: readonly SourceBlock[] | null;
}
/** Project one Computer Use call without exposing typed text, assigned values, or UI-tree text. */
export declare function projectComputerUseTool(input: ToolProjectionInput): ToolProjection | null;
/** Register Computer Use audit presentation into the active DSH client. */
export declare function apply(ctx: Context): Promise<void>;
export {};
