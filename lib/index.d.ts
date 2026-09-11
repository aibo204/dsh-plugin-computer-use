import { ComputerUseArchiveCleanupResult, ComputerUseArchiveController, ComputerUseArchiveInput, ComputerUseArchiveMode, ComputerUseArchiveRecord, ComputerUseArchiveService, ComputerUseArchiveSettings } from "./archive.js";
import z from "@deepseek-ai/schemastery";
import { ReconnectConfig } from "@deepseek-ai/dsh-mcp-client";
import { Context } from "@deepseek-ai/cordis";
//#region src/index.d.ts
/** Cordis plugin name used by Loader diagnostics. */
declare const name = "computer-use";
/** Services required by the plugin and its MCP bridge. */
declare const inject: string[];
/** Stable MCP namespace, matching the Computer Use family in tool names. */
declare const COMPUTER_USE_SERVER_NAME = "computer_use";
/** Public-name prefix assigned by `dsh-mcp-client` to every Computer Use tool. */
declare const COMPUTER_USE_TOOL_PREFIX = "mcp__computer_use__";
/** Access policy applied before any Computer Use MCP tool dispatches. */
type ComputerUseAccessPolicy = 'per-call' | 'allow-observation' | 'allow';
/** Safety class assigned to a Computer Use tool before dispatch. */
type ComputerUseOperation = 'observe' | 'control';
/** Automatic audit screenshots captured around admitted control actions. */
type AutomaticScreenshotMode = 'off' | 'after-action' | 'before-and-after';
/** Consequential desktop effect recognized from the current accessibility snapshot. */
type ComputerUseHighRiskCategory = 'send' | 'delete' | 'purchase' | 'upload';
/** Configurable phrases used to recognize consequential controls. */
interface ComputerUseHighRiskKeywords {
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
interface Config {
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
declare const Config: z<Config>;
/**
 * Resolve the launcher from this package's dependency closure rather than the
 * user's PATH, so Profile installation selects the pinned native runtime.
 * @returns absolute path to the package-local Node launcher.
 */
declare function resolveOpenComputerUseLauncher(): string;
/** Model guidance for semantic-first, observable desktop operation. */
declare const COMPUTER_USE_PROMPT: string;
/**
 * Whether one public tool name belongs to this plugin's MCP namespace.
 * @param toolName - public name registered in the DSH tool registry.
 * @returns true for names owned by the fixed Computer Use MCP server namespace.
 */
declare function isComputerUseTool(toolName: string): boolean;
/**
 * Classify a public Computer Use tool for access control. New tools default to
 * control so an upstream schema addition cannot silently gain observation access.
 * @param toolName - public name registered in the DSH tool registry.
 * @returns the operation class, or undefined for another tool namespace.
 */
declare function classifyComputerUseTool(toolName: string): ComputerUseOperation | undefined;
/**
 * Decide whether one admitted Computer Use operation needs one-shot approval.
 * @param accessPolicy - configured desktop access policy.
 * @param operation - tool safety class.
 * @returns true when the operation must ask before dispatch.
 */
declare function requiresComputerUseApproval(accessPolicy: ComputerUseAccessPolicy, operation: ComputerUseOperation): boolean;
/**
 * Format a privacy-preserving approval reason for one Computer Use dispatch.
 * Literal text and values are represented only by metadata.
 * @param toolName - public Computer Use tool name.
 * @param argsValue - untrusted parsed tool arguments.
 * @returns approval text naming the class, native action, app, and safe target details.
 */
declare function formatComputerUseApprovalReason(toolName: string, argsValue: unknown): string;
/**
 * Launch one native MCP process and expose its tools in the current Cordis
 * scope. Mount this plugin in an Agent Preset so process state, element indexes,
 * action approvals, and teardown are Session-owned.
 * @param ctx - plugin context carrying tool, prompt, subprocess, and optional approval services.
 * @param config - desktop access, process, timeout, and cleanup policy.
 * @returns startup readiness after MCP launch and initial tool discovery.
 */
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { AutomaticScreenshotMode, COMPUTER_USE_PROMPT, COMPUTER_USE_SERVER_NAME, COMPUTER_USE_TOOL_PREFIX, ComputerUseAccessPolicy, type ComputerUseArchiveCleanupResult, ComputerUseArchiveController, type ComputerUseArchiveInput, type ComputerUseArchiveRecord, ComputerUseArchiveService, type ComputerUseArchiveSettings, ComputerUseHighRiskCategory, ComputerUseHighRiskKeywords, ComputerUseOperation, Config, apply, classifyComputerUseTool, formatComputerUseApprovalReason, inject, isComputerUseTool, name, requiresComputerUseApproval, resolveOpenComputerUseLauncher };