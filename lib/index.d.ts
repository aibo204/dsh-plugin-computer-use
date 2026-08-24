/**
 * Agent-scoped local desktop Computer Use plugin. It launches the package-local
 * Open Computer Use MCP server, registers its Codex-compatible tools through
 * `dsh-mcp-client`, gates real-desktop access, and clears transient desktop
 * state when an agent turn ends.
 * @module @valkia/dsh-plugin-computer-use
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ReconnectConfig } from '@deepseek-ai/dsh-mcp-client';
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "computer-use";
/** Services required by the plugin and its MCP bridge. */
export declare const inject: string[];
/** Stable MCP namespace, matching the Computer Use family in tool names. */
export declare const COMPUTER_USE_SERVER_NAME = "computer_use";
/** Public-name prefix assigned by `dsh-mcp-client` to every Computer Use tool. */
export declare const COMPUTER_USE_TOOL_PREFIX = "mcp__computer_use__";
/** Access policy applied before any Computer Use MCP tool dispatches. */
export type ComputerUseAccessPolicy = 'per-call' | 'allow';
/** Plugin configuration. */
export interface Config {
    /** Desktop-access approval mode. `per-call` keeps every accepted action one-shot. */
    accessPolicy?: ComputerUseAccessPolicy;
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
 * Launch one native MCP process and expose its tools in the current Cordis
 * scope. Mount this plugin in an Agent Preset so process state, element indexes,
 * action approvals, and teardown are Session-owned.
 * @param ctx - plugin context carrying tool, prompt, subprocess, and optional approval services.
 * @param config - desktop access, process, timeout, and cleanup policy.
 * @returns startup readiness after MCP launch and initial tool discovery.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;