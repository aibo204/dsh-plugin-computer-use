import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { Service } from "@deepseek-ai/cordis";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/archive.ts
/** Local Computer Use evidence archive and its browser Remote API. */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
const ARCHIVE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function mediaExtension(mediaType) {
	switch (mediaType) {
		case "image/jpeg": return "jpg";
		case "image/webp": return "webp";
		case "image/gif": return "gif";
		default: return "png";
	}
}
function parseRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const row = value;
	if (row["version"] !== 1 || typeof row["id"] !== "string" || !ARCHIVE_ID.test(row["id"])) return void 0;
	if (typeof row["sessionId"] !== "string" || typeof row["callId"] !== "string") return void 0;
	if (!Number.isSafeInteger(row["createdAt"]) || typeof row["action"] !== "string") return void 0;
	if (typeof row["succeeded"] !== "boolean" || typeof row["pinned"] !== "boolean") return void 0;
	if (!Number.isSafeInteger(row["bytes"]) || row["bytes"] < 0 || !Array.isArray(row["images"])) return void 0;
	const images = [];
	for (const image of row["images"]) {
		if (typeof image !== "object" || image === null || Array.isArray(image)) return void 0;
		const entry = image;
		if (entry["phase"] !== "before" && entry["phase"] !== "after" || typeof entry["file"] !== "string" || !/^(before|after)-\d+\.(png|jpg|webp|gif)$/u.test(entry["file"]) || typeof entry["mediaType"] !== "string") return void 0;
		images.push({
			phase: entry["phase"],
			file: entry["file"],
			mediaType: entry["mediaType"]
		});
	}
	const category = row["category"];
	if (category !== void 0 && category !== "send" && category !== "delete" && category !== "purchase" && category !== "upload") return void 0;
	const app = row["app"];
	if (app !== void 0 && typeof app !== "string") return void 0;
	return {
		version: 1,
		id: row["id"],
		sessionId: row["sessionId"],
		callId: row["callId"],
		createdAt: row["createdAt"],
		action: row["action"],
		succeeded: row["succeeded"],
		pinned: row["pinned"],
		bytes: row["bytes"],
		phases: images.map((image) => image.phase),
		images,
		...app === void 0 ? {} : { app },
		...category === void 0 ? {} : { category }
	};
}
/** Atomic local archive with serialized mutation and bounded retention. */
var ComputerUseArchiveService = class extends Service {
	/** Absolute private archive root. */
	root;
	queue = Promise.resolve();
	settings;
	/** @param ctx - root Host context carrying the attachment provider. */
	constructor(ctx, settings, root = join(resolveDshHome(), "computer-use-archive", "v1")) {
		super(ctx, "computerUseArchive");
		this.settings = settings;
		this.root = root;
	}
	/** Replace the effective retention policy after a settings commit. */
	configure(settings) {
		this.settings = settings;
		this.cleanup().catch((error) => {
			this.ctx.logger.warn("computer-use: archive cleanup after settings update failed: %s", error instanceof Error ? error.message : String(error));
		});
	}
	/** Read the current policy for an Agent-scoped capture decision. */
	policy() {
		return this.settings;
	}
	/** Commit one action record and enforce retention after publication. */
	archive(input) {
		return this.serial(async () => {
			if (input.images.length === 0) return;
			const attachments = this.ctx.get("attachments");
			if (attachments === void 0) return;
			await mkdir(this.root, {
				recursive: true,
				mode: 448
			});
			const id = randomUUID();
			const temporary = join(this.root, `.tmp-${id}`);
			const destination = join(this.root, id);
			await mkdir(temporary, { mode: 448 });
			try {
				let bytes = 0;
				const images = [];
				for (const [index, image] of input.images.entries()) {
					const stored = await attachments.readImage(image.attachment);
					const file = `${image.phase}-${String(index)}.${mediaExtension(stored.ref.mediaType)}`;
					await writeFile(join(temporary, file), stored.data, { mode: 384 });
					bytes += stored.data.byteLength;
					images.push({
						phase: image.phase,
						file,
						mediaType: stored.ref.mediaType
					});
				}
				const record = {
					version: 1,
					id,
					sessionId: String(input.agent.id),
					callId: input.callId,
					createdAt: Date.now(),
					action: input.action,
					succeeded: input.succeeded,
					pinned: input.category !== void 0 && this.settings.archiveAutoPinHighRisk,
					bytes,
					phases: images.map((image) => image.phase),
					images,
					...input.app === void 0 ? {} : { app: input.app },
					...input.category === void 0 ? {} : { category: input.category }
				};
				await writeFile(join(temporary, "record.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 384 });
				await rename(temporary, destination);
			} catch (error) {
				await rm(temporary, {
					recursive: true,
					force: true
				});
				throw error;
			}
			await this.cleanupUnlocked();
		});
	}
	/** List newest records first; malformed or partial directories stay invisible. */
	list() {
		return this.serial(async () => (await this.records()).map(({ images: _images, version: _version, ...record }) => record));
	}
	/** Return one archived image as canonical base64 for an on-demand preview. */
	image(id, phase) {
		return this.serial(async () => {
			const image = (await this.record(id)).images.find((candidate) => candidate.phase === phase);
			if (image === void 0) throw new Error(`archive ${id} has no ${phase} image`);
			return {
				mediaType: image.mediaType,
				data: (await readFile(join(this.root, id, image.file))).toString("base64")
			};
		});
	}
	/** Set or clear one record's retention pin. */
	pin(id, pinned) {
		return this.serial(async () => {
			const next = {
				...await this.record(id),
				pinned
			};
			const path = join(this.root, id, "record.json");
			const temporary = `${path}.tmp`;
			await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 384 });
			await rename(temporary, path);
			const { images: _images, version: _version, ...record } = next;
			return record;
		});
	}
	/** Delete one archive record and its private screenshot copies. */
	delete(id) {
		return this.serial(async () => {
			await this.record(id);
			await rm(join(this.root, id), {
				recursive: true,
				force: true
			});
		});
	}
	/** Remove expired and over-quota unpinned records. */
	cleanup() {
		return this.serial(() => this.cleanupUnlocked());
	}
	serial(work) {
		const result = this.queue.then(work, work);
		this.queue = result.then(() => void 0, () => void 0);
		return result;
	}
	async cleanupUnlocked() {
		const records = await this.records();
		const cutoff = Date.now() - this.settings.archiveRetentionDays * 864e5;
		let total = records.reduce((sum, record) => sum + record.bytes, 0);
		let deleted = 0;
		let bytesFreed = 0;
		for (const record of [...records].reverse()) {
			if (record.pinned) continue;
			if (record.createdAt >= cutoff && total <= this.settings.archiveMaxBytes) continue;
			await rm(join(this.root, record.id), {
				recursive: true,
				force: true
			});
			total -= record.bytes;
			bytesFreed += record.bytes;
			deleted += 1;
		}
		return {
			deleted,
			bytesFreed,
			remainingBytes: total
		};
	}
	async records() {
		const entries = await readdir(this.root, { withFileTypes: true }).catch((error) => {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
			throw error;
		});
		const records = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || !ARCHIVE_ID.test(entry.name)) continue;
			const record = parseRecord(await readFile(join(this.root, entry.name, "record.json"), "utf8").then((text) => JSON.parse(text)).catch(() => void 0));
			if (record !== void 0 && record.id === entry.name) records.push(record);
		}
		return records.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
	}
	async record(id) {
		this.assertId(id);
		const parsed = parseRecord(JSON.parse(await readFile(join(this.root, id, "record.json"), "utf8")));
		if (parsed === void 0 || parsed.id !== id) throw new Error(`archive ${id} is invalid`);
		return parsed;
	}
	assertId(id) {
		if (!ARCHIVE_ID.test(id)) throw new Error("archive id is invalid");
	}
};
/** Browser Remote adapter for private archive management. */
let ComputerUseArchiveController = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _image_decorators;
	let _pin_decorators;
	let _delete_decorators;
	let _cleanup_decorators;
	return class ComputerUseArchiveController extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote];
			_image_decorators = [Remote];
			_pin_decorators = [Remote];
			_delete_decorators = [Remote];
			_cleanup_decorators = [Remote];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _image_decorators, {
				kind: "method",
				name: "image",
				static: false,
				private: false,
				access: {
					has: (obj) => "image" in obj,
					get: (obj) => obj.image
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _pin_decorators, {
				kind: "method",
				name: "pin",
				static: false,
				private: false,
				access: {
					has: (obj) => "pin" in obj,
					get: (obj) => obj.pin
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _delete_decorators, {
				kind: "method",
				name: "delete",
				static: false,
				private: false,
				access: {
					has: (obj) => "delete" in obj,
					get: (obj) => obj.delete
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _cleanup_decorators, {
				kind: "method",
				name: "cleanup",
				static: false,
				private: false,
				access: {
					has: (obj) => "cleanup" in obj,
					get: (obj) => obj.cleanup
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		constructor(ctx) {
			super(ctx, "computerUseArchiveController", { namespace: "computerUseArchive" });
			__runInitializers(this, _instanceExtraInitializers);
		}
		/** @returns newest archive records first. */
		list() {
			return this.ctx.computerUseArchive.list();
		}
		/** @returns one image encoded for a browser data URL. */
		async image(id, phase) {
			try {
				return await this.ctx.computerUseArchive.image(id, phase);
			} catch (error) {
				throw new RemoteError("computer-use-archive/not-found", `archive image ${id}/${phase} was not found`, { id }, { cause: error });
			}
		}
		/** @returns updated record after changing its pin. */
		async pin(id, pinned) {
			try {
				return await this.ctx.computerUseArchive.pin(id, pinned);
			} catch (error) {
				throw new RemoteError("computer-use-archive/not-found", `archive ${id} was not found`, { id }, { cause: error });
			}
		}
		/** Delete one record and its private screenshot copies. */
		async delete(id) {
			try {
				await this.ctx.computerUseArchive.delete(id);
			} catch (error) {
				throw new RemoteError("computer-use-archive/not-found", `archive ${id} was not found`, { id }, { cause: error });
			}
		}
		/** @returns counts and bytes from an immediate cleanup pass. */
		cleanup() {
			return this.ctx.computerUseArchive.cleanup();
		}
	};
})();
//#endregion
export { ComputerUseArchiveController, ComputerUseArchiveService };
