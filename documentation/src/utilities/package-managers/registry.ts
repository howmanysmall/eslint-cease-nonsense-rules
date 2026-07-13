export type PackageManagerId = "ni" | "pnpm" | "aube" | "bun" | "yarn" | "vlt" | "npm";

export type PackageManagerCommandType = "add" | "run";

export interface PackageManagerCommands {
	readonly add: string;
	readonly developmentOption: string;
	readonly run: string;
}

export interface PackageManagerDefinition {
	readonly commands: PackageManagerCommands;
	/** Built-in Starlight icon name when available. */
	readonly icon?: string;
	/**
	 * Path under `documentation/public/` for managers without a Starlight icon. Rendered as an inline SVG in the
	 * package-managers tabs.
	 */
	readonly iconSrc?: string;
	readonly id: PackageManagerId;
	readonly label: string;
}

export interface CustomPackageManagerIconEntry {
	readonly iconSrc: string;
	readonly label: string;
}

export interface BuildCommandOptions {
	readonly development?: boolean;
	readonly packageName?: string;
	readonly parameters?: string;
	readonly type: PackageManagerCommandType;
}

/** Tab order for install UI. Default selected manager is separate (`defaultSelectedManager`). */
export const defaultManagerOrder = [
	"ni",
	"pnpm",
	"aube",
	"bun",
	"yarn",
	"vlt",
	"npm",
] as const satisfies ReadonlyArray<PackageManagerId>;

export const defaultSelectedManager = "pnpm" satisfies PackageManagerId;

export const packageManagerRegistry: Record<PackageManagerId, PackageManagerDefinition> = {
	aube: {
		commands: {
			add: "aube add",
			developmentOption: "-D",
			run: "aube run",
		},
		iconSrc: "icons/aube.svg",
		id: "aube",
		label: "aube",
	},
	bun: {
		commands: {
			add: "bun add",
			developmentOption: "-d",
			run: "bun run",
		},
		icon: "bun",
		id: "bun",
		label: "bun",
	},
	ni: {
		commands: {
			add: "ni",
			developmentOption: "-D",
			run: "nr",
		},
		iconSrc: "icons/ni.svg",
		id: "ni",
		label: "ni",
	},
	npm: {
		commands: {
			add: "npm install",
			developmentOption: "-D",
			run: "npm run",
		},
		icon: "seti:npm",
		id: "npm",
		label: "npm",
	},
	pnpm: {
		commands: {
			add: "pnpm add",
			developmentOption: "-D",
			run: "pnpm run",
		},
		icon: "pnpm",
		id: "pnpm",
		label: "pnpm",
	},
	vlt: {
		commands: {
			add: "vlt install",
			developmentOption: "-D",
			run: "vlt run",
		},
		iconSrc: "icons/vlt.svg",
		id: "vlt",
		label: "vlt",
	},
	yarn: {
		commands: {
			add: "yarn add",
			developmentOption: "-D",
			run: "yarn run",
		},
		icon: "seti:yarn",
		id: "yarn",
		label: "yarn",
	},
};

/**
 * Managers that need custom tab art because Starlight has no matching icon.
 *
 * @param order - Manager ids in display order (defaults to install UI order).
 * @returns Label + public SVG path pairs for custom tab icons.
 */
export function getCustomPackageManagerIconEntries(
	order: ReadonlyArray<PackageManagerId> = defaultManagerOrder,
): ReadonlyArray<CustomPackageManagerIconEntry> {
	const entries: Array<CustomPackageManagerIconEntry> = [];
	for (const managerId of order) {
		const definition = packageManagerRegistry[managerId];
		if (definition.iconSrc === undefined) {
			continue;
		}
		entries.push({
			iconSrc: definition.iconSrc,
			label: definition.label,
		});
	}
	return entries;
}

export const packageManagersSyncKey = "cease-nonsense-pkg";

export const publishedPackageName = "@pobammer-ts/eslint-cease-nonsense-rules";

export function resolveManagerOrder(
	managers: ReadonlyArray<PackageManagerId> | undefined = defaultManagerOrder,
): ReadonlyArray<PackageManagerId> {
	return managers;
}

function buildExecutableCommand(managerId: PackageManagerId, parameters: string): string {
	switch (managerId) {
		case "npm": {
			return `npx ${parameters}`;
		}
		case "pnpm": {
			return `pnpm exec ${parameters}`;
		}
		case "yarn": {
			return `yarn ${parameters}`;
		}
		case "bun": {
			return `bunx ${parameters}`;
		}
		case "vlt": {
			return `vlt exec ${parameters}`;
		}
		case "ni": {
			return `nlx ${parameters}`;
		}
		case "aube": {
			// `aube run` = package.json scripts; local bins = `aube exec` (alias `x`).
			// `aubx` is dlx-style (throwaway env), not project node_modules.
			return `aube exec ${parameters}`;
		}
		default: {
			return parameters;
		}
	}
}

function isDirectExecutable(parameters: string): boolean {
	return parameters.startsWith("eslint") || parameters.startsWith(".");
}

export function buildPackageManagerCommand(managerId: PackageManagerId, options: BuildCommandOptions): string {
	const manager = packageManagerRegistry[managerId];
	const { type, packageName, development = false, parameters } = options;

	if (type === "add") {
		const parts: Array<string> = [manager.commands.add];
		if (development) {
			parts.push(manager.commands.developmentOption);
		}
		if (packageName !== undefined && packageName.length > 0) {
			parts.push(packageName);
		}
		if (parameters !== undefined && parameters.length > 0) {
			parts.push(parameters);
		}
		return parts.join(" ");
	}

	if (parameters !== undefined && parameters.length > 0) {
		if (isDirectExecutable(parameters)) {
			return buildExecutableCommand(managerId, parameters);
		}
		return `${manager.commands.run} ${parameters}`;
	}

	return manager.commands.run;
}
