import type { EnvironmentMode } from "@lint-types/environment-mode";
import type { TSESTree } from "@typescript-eslint/types";

const REACT_SOURCES_ROBLOX = new Set(["@rbxts/react", "@rbxts/roact"]);
const REACT_SOURCES_STANDARD = new Set(["react", "react-dom"]);

export function getReactSources(environment: EnvironmentMode): ReadonlySet<string> {
	return environment === "roblox-ts" ? REACT_SOURCES_ROBLOX : REACT_SOURCES_STANDARD;
}

export function isReactImport(node: TSESTree.ImportDeclaration, reactSources: ReadonlySet<string>): boolean {
	return reactSources.has(node.source.value);
}
