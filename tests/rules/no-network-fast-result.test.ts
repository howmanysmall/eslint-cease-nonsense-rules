import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$rules/no-network-fast-result";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

const fixturesDir = nodePath.join(import.meta.dirname, "../fixtures/no-network-fast-result");
function filename(name: string): string {
	return nodePath.join(fixturesDir, `${name}.ts`);
}

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts"],
				defaultProject: nodePath.join(fixturesDir, "tsconfig.json"),
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
			},
			tsconfigRootDir: fixturesDir,
		},
		sourceType: "module",
	},
});

const imports = `
import { Networking } from "@flamework/networking";
import type { FastResult } from "./fast-result.js";
`;

describe("no-network-fast-result", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("no-network-fast-result", rule, {
		invalid: [
			{
				code: `${imports}
interface ClientToServer {
	warp: { toCFrame: () => FastResult };
}
Networking.createFunction<ClientToServer, undefined>();`,
				errors: [
					{
						column: 26,
						endColumn: 36,
						endLine: 6,
						line: 6,
						messageId: "noNetworkFastResult",
					},
				],
				filename: filename("direct-response"),
			},
			{
				code: `
import * as Networking from "@flamework/networking";
import type { FastResult } from "./fast-result.js";

interface ClientToServer {
	warp: { toCFrame: () => FastResult };
}
Networking.createFunction<ClientToServer, undefined>();`,
				errors: [{ messageId: "noNetworkFastResult" }],
				filename: filename("namespace-response"),
			},

			{
				code: `${imports}
	type Result = FastResult;
type Response = Promise<Result> | undefined;
interface ClientToServer {
	request: { get: () => Response };
}
Networking.createFunction<ClientToServer, undefined>();`,
				errors: [{ messageId: "noNetworkFastResult" }],
				filename: filename("aliased-response"),
			},
			{
				code: `${imports}
interface ServerToClient {
	state: { get: () => FastResult };
}
Networking.createFunction<undefined, ServerToClient>();`,
				errors: [{ messageId: "noNetworkFastResult" }],
				filename: filename("server-response"),
			},
			{
				code: `${imports}
interface ClientToServer {
	request: { send: (result: FastResult) => boolean };
}
Networking.createFunction<ClientToServer, undefined>();`,
				errors: [{ messageId: "noNetworkFastResult" }],
				filename: filename("parameter"),
				options: [{ checkParameters: true }],
			},
		],
		valid: [
			{
				code: `${imports}
function localHelper(): FastResult {
	return [true];
}
localHelper();`,
				filename: filename("local-helper"),
			},
			{
				code: `${imports}
interface ClientToServer {
	request: { send: (result: FastResult) => boolean };
}
Networking.createFunction<ClientToServer, undefined>();`,
				filename: filename("parameter-default"),
			},
			{
				code: `${imports}
type Serializable = boolean;
interface ClientToServer {
	request: { send: (value: Serializable) => Promise<Serializable> };
}
Networking.createFunction<ClientToServer, undefined>();`,
				filename: filename("serializable-parameter"),
				options: [{ checkParameters: true }],
			},
			{
				code: `${imports}
interface ClientToServer {
	request: { get: () => { success: boolean; message?: string } };
}
Networking.createFunction<ClientToServer, undefined>();`,
				filename: filename("serializable-response"),
			},
			{
				code: `${imports}
namespace OtherNetworking {
	export function createFunction<ClientToServer, ServerToClient>(): void {}
}
interface ClientToServer {
	request: { get: () => FastResult };
}
OtherNetworking.createFunction<ClientToServer, undefined>();`,
				filename: filename("other-networking"),
			},
		],
	});
});
