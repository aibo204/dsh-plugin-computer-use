/**
 * Agent-scoped local desktop Computer Use plugin. It launches the package-local
 * Open Computer Use MCP server, registers its Codex-compatible tools through
 * `dsh-mcp-client`, gates real-desktop access, and clears transient desktop
 * state when an agent turn ends.
 * @module @aibo204/dsh-plugin-computer-use
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ReconnectConfig } from '@deepseek-ai/dsh-mcp-client';
import { type ComputerUseArchiveMode } from './archive.ts';
export { ComputerUseArchiveController, ComputerUseArchiveService, } from './archive.ts';
export type { ComputerUseArchiveCleanupResult, ComputerUseArchiveInput, ComputerUseArchiveRecord, ComputerUseArchiveSettings, } from './archive.ts';
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "computer-use";
/** Services required by the plugin and its MCP bridge. */
export declare const inject: string[];
/** Stable MCP namespace, matching the Computer Use family in tool names. */
export declare const COMPUTER_USE_SERVER_NAME = "computer_use";
/** Public-name prefix assigned by `dsh-mcp-client` to every Computer Use tool. */
export declare const COMPUTER_USE_TOOL_PREFIX = "mcp__computer_use__";
/** Access policy applied before any Computer Use MCP tool dispatches. */
export type ComputerUseAccessPolicy = 'per-call' | 'allow-observation' | 'allow';
/** Safety class assigned to a Computer Use tool before dispatch. */
export type ComputerUseOperation = 'observe' | 'control';
/** Automatic audit screenshots captured around admitted control actions. */
export type AutomaticScreenshotMode = 'off' | 'after-action' | 'before-and-after';
/** Consequential desktop effect recognized from the current accessibility snapshot. */
export type ComputerUseHighRiskCategory = 'send' | 'delete' | 'purchase' | 'upload';
/** Configurable phrases used to recognize consequential controls. */
export interface ComputerUseHighRiskKeywords {
    /** Controls that send, submit, publish, post, or reply. */
    send?: string[];
    /** Controls that delete, remove, erase, or move content to trash. */
    delete?: string[];
    /** Controls that buy, pay, check out, order, or subscribe. */
    purchase?: string[];
    /** Controls that upload, attach, or select a file. */
    upload?: string[];
}
/** Plugin configuration. */
export interface Config {
    /** Mount only the package's browser companion without starting desktop integration. */
    clientCompanionOnly?: boolean;
    /** Desktop-access approval mode, from one-shot calls through explicit full access. */
    accessPolicy?: ComputerUseAccessPolicy;
    /** Exact app names or bundle ids admitted when the list is non-empty. */
    allowedApps?: string[];
    /** Exact app names or bundle ids denied before approval. */
    deniedApps?: string[];
    /** Require a dedicated confirmation for recognized consequential actions even under `allow`. */
    highRiskConfirmation?: boolean;
    /** Confirm target-activating actions that cannot be matched to a current accessibility element. */
    confirmUnknownActivations?: boolean;
    /** Phrases that classify current accessibility elements into consequential action categories. */
    highRiskKeywords?: ComputerUseHighRiskKeywords;
    /** Per-MCP-tool deadline in milliseconds. */
    toolCallTimeoutMs?: number;
    /** Whether initial MCP launch or tool discovery failure rejects plugin activation. */
    failOnStartupError?: boolean;
    /** Automatic reconnect policy after the native MCP process exits unexpectedly. */
    reconnect?: ReconnectConfig;
    /** Explicit environment entries for the native runtime, merged over the MCP bridge's scrubbed parent env. */
    env?: Record<string, string>;
    /** Working directory for the native runtime; empty lets the transport use its default. */
    cwd?: string;
    /** Send the runtime's turn-ended cleanup notification after a turn that used Computer Use. */
    cleanupOnTurnEnd?: boolean;
    /** Automatic audit screenshots captured through the same MCP connection as the action. */
    automaticScreenshots?: AutomaticScreenshotMode;
    /** Private evidence archive selection policy. */
    archiveMode?: ComputerUseArchiveMode;
    /** Days to keep an unpinned archive record. */
    archiveRetentionDays?: number;
    /** Maximum aggregate bytes retained by the private archive. */
    archiveMaxBytes?: number;
    /** Pin recognized high-risk records when they are created. */
    archiveAutoPinHighRisk?: boolean;
    /** Maximum automatic screenshot attempts for one Agent turn. */
    maxAutomaticScreenshotsPerTurn?: number;
    /** Hard reservation budget for automatically stored screenshot bytes in one Agent turn. */
    maxAutomaticScreenshotBytesPerTurn?: number;
    /** Deadline for the one-shot turn-ended notifier. */
    cleanupTimeoutMs?: number;
    /** Process-tree termination grace for the one-shot turn-ended notifier. */
    cleanupGraceMs?: number;
}
/** Loader schema for the Computer Use integration. */
export declare const Config: z<Config>;
/**
 * Resolve the launcher from this package's dependency closure rather than the
 * user's PATH, so Profile installation selects the pinned native runtime.
 * @returns absolute path to the package-local Node launcher.
 */
export declare function resolveOpenComputerUseLauncher(): string;
/** Model guidance for semantic-first, observable desktop operation. */
export declare const COMPUTER_USE_PROMPT: string;
/**
 * Whether one public tool name belongs to this plugin's MCP namespace.
 * @param toolName - public name registered in the DSH tool registry.
 * @returns true for names owned by the fixed Computer Use MCP server namespace.
 */
export declare function isComputerUseTool(toolName: string): boolean;
/**
 * Classify a public Computer Use tool for access control. New tools default to
 * control so an upstream schema addition cannot silently gain observation access.
 * @param toolName - public name registered in the DSH tool registry.
 * @returns the operation class, or undefined for another tool namespace.
 */
export declare function classifyComputerUseTool(toolName: string): ComputerUseOperation | undefined;
/**
 * Decide whether one admitted Computer Use operation needs one-shot approval.
 * @param accessPolicy - configured desktop access policy.
 * @param operation - tool safety class.
 * @returns true when the operation must ask before dispatch.
 */
export declare function requiresComputerUseApproval(accessPolicy: ComputerUseAccessPolicy, operation: ComputerUseOperation): boolean;
/**
 * Format a privacy-preserving approval reason for one Computer Use dispatch.
 * Literal text and values are represented only by metadata.
 * @param toolName - public Computer Use tool name.
 * @param argsValue - untrusted parsed tool arguments.
 * @returns approval text naming the class, native action, app, and safe target details.
 */
export declare function formatComputerUseApprovalReason(toolName: string, argsValue: unknown): string;
/**
 * Launch one native MCP process and expose its tools in the current Cordis
 * scope. Mount this plugin in an Agent Preset so process state, element indexes,
 * action approvals, and teardown are Session-owned.
 * @param ctx - plugin context carrying tool, prompt, subprocess, and optional approval services.
 * @param config - desktop access, process, timeout, and cleanup policy.
 * @returns startup readiness after MCP launch and initial tool discovery.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;
