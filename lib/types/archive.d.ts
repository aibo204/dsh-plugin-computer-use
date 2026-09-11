/** Local Computer Use evidence archive and its browser Remote API. */
import { Context, Service } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/** Which admitted control actions receive a private evidence archive. */
export type ComputerUseArchiveMode = 'off' | 'high-risk' | 'all-control';
/** Mutable archive policy supplied by the settings namespace. */
export interface ComputerUseArchiveSettings {
    /** Action selection policy. */
    archiveMode: ComputerUseArchiveMode;
    /** Days an unpinned record remains eligible for retention. */
    archiveRetentionDays: number;
    /** Maximum aggregate screenshot bytes across unpinned and pinned records. */
    archiveMaxBytes: number;
    /** Keep recognized high-risk records until the user unpins them. */
    archiveAutoPinHighRisk: boolean;
}
/** One screenshot copied into a private archive record. */
export interface ComputerUseArchiveImage {
    readonly phase: 'before' | 'after';
    readonly attachment: Extract<ContentBlock, {
        type: 'image';
    }>['attachment'];
}
/** Input committed after one admitted Computer Use control settles. */
export interface ComputerUseArchiveInput {
    readonly agent: Agent;
    readonly callId: string;
    readonly app?: string;
    readonly action: string;
    readonly category?: 'send' | 'delete' | 'purchase' | 'upload';
    readonly succeeded: boolean;
    readonly images: readonly ComputerUseArchiveImage[];
}
/** Metadata returned to the settings archive browser. */
export interface ComputerUseArchiveRecord {
    readonly id: string;
    readonly sessionId: string;
    readonly callId: string;
    readonly createdAt: number;
    readonly app?: string;
    readonly action: string;
    readonly category?: 'send' | 'delete' | 'purchase' | 'upload';
    readonly succeeded: boolean;
    readonly pinned: boolean;
    readonly bytes: number;
    readonly phases: readonly ('before' | 'after')[];
}
/** Result of an explicit or automatic retention pass. */
export interface ComputerUseArchiveCleanupResult {
    readonly deleted: number;
    readonly bytesFreed: number;
    readonly remainingBytes: number;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Process-wide private evidence archive shared by Computer Use session instances. */
        computerUseArchive: ComputerUseArchiveService;
        /** Host owner of the `computerUseArchive` Remote namespace. */
        computerUseArchiveController: ComputerUseArchiveController;
    }
}
/** Atomic local archive with serialized mutation and bounded retention. */
export declare class ComputerUseArchiveService extends Service {
    /** Absolute private archive root. */
    readonly root: string;
    private queue;
    private settings;
    /** @param ctx - root Host context carrying the attachment provider. */
    constructor(ctx: Context, settings: ComputerUseArchiveSettings, root?: string);
    /** Replace the effective retention policy after a settings commit. */
    configure(settings: ComputerUseArchiveSettings): void;
    /** Read the current policy for an Agent-scoped capture decision. */
    policy(): ComputerUseArchiveSettings;
    /** Commit one action record and enforce retention after publication. */
    archive(input: ComputerUseArchiveInput): Promise<void>;
    /** List newest records first; malformed or partial directories stay invisible. */
    list(): Promise<ComputerUseArchiveRecord[]>;
    /** Return one archived image as canonical base64 for an on-demand preview. */
    image(id: string, phase: 'before' | 'after'): Promise<{
        mediaType: string;
        data: string;
    }>;
    /** Set or clear one record's retention pin. */
    pin(id: string, pinned: boolean): Promise<ComputerUseArchiveRecord>;
    /** Delete one archive record and its private screenshot copies. */
    delete(id: string): Promise<void>;
    /** Remove expired and over-quota unpinned records. */
    cleanup(): Promise<ComputerUseArchiveCleanupResult>;
    private serial;
    private cleanupUnlocked;
    private records;
    private record;
    private assertId;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        /** An archive record or requested phase does not exist. */
        'computer-use-archive/not-found': {
            readonly id: string;
        };
    }
}
/** Browser Remote adapter for private archive management. */
export declare class ComputerUseArchiveController extends TypertRemoteService {
    constructor(ctx: Context);
    /** @returns newest archive records first. */
    list(): Promise<ComputerUseArchiveRecord[]>;
    /** @returns one image encoded for a browser data URL. */
    image(id: string, phase: 'before' | 'after'): Promise<{
        mediaType: string;
        data: string;
    }>;
    /** @returns updated record after changing its pin. */
    pin(id: string, pinned: boolean): Promise<ComputerUseArchiveRecord>;
    /** Delete one record and its private screenshot copies. */
    delete(id: string): Promise<void>;
    /** @returns counts and bytes from an immediate cleanup pass. */
    cleanup(): Promise<ComputerUseArchiveCleanupResult>;
}
