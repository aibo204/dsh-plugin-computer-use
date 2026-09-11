import { Context } from "@deepseek-ai/cordis";
//#region src/invariant.d.ts
/** Cordis companion plugin name. */
declare const name = "computer-use-invariant";
/** Service required before the companion can reserve package ownership. */
declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - plugin context carrying the invariant registry.
 * @returns the installed registration's disposer.
 */
declare const apply: (ctx: Context) => Promise<() => void>;
//#endregion
export { apply, inject, name };