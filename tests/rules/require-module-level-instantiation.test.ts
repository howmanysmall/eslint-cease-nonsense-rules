import { describe } from "bun:test";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/require-module-level-instantiation";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

describe("require-module-level-instantiation", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("require-module-level-instantiation", rule, {
		invalid: [
			// Default import - inside function
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function useStoryModesState() {
	const log = new Log();
	log.Info("test");
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Default import - inside arrow function
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

const handler = () => {
	const log = new Log();
};`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Default import - inside method
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

class MyClass {
	doThing() {
		const log = new Log();
	}
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Named import - inside function
			{
				code: `
import { Logger } from "@company/logging";

function init() {
	const logger = new Logger();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Logger: "@company/logging" } }],
			},
			// Named import with alias - inside function
			{
				code: `
import { Logger as Log } from "@company/logging";

function init() {
	const log = new Log();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Logger: "@company/logging" } }],
			},
			// Multiple tracked classes - both inside function
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { Server } from "@rbxts/net";

function setup() {
	const log = new Log();
	const server = new Server();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }, { messageId: "mustBeModuleLevel" }],
				options: [
					{
						classes: {
							Log: "@rbxts/rbxts-sleitnick-log",
							Server: "@rbxts/net",
						},
					},
				],
			},
			// Nested function scope
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function outer() {
	function inner() {
		const log = new Log();
	}
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Inside IIFE
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

(function() {
	const log = new Log();
})();`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Inside callback
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

items.forEach(() => {
	const log = new Log();
});`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Namespace import with member access
			{
				code: `
import * as Logging from "@rbxts/rbxts-sleitnick-log";

function init() {
	const log = new Logging.Log();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
		],
		valid: [
			// Module level - default import
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

const log = new Log();

function useStoryModesState() {
	log.Info("test");
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Module level - named import
			{
				code: `
import { Logger } from "@company/logging";

const logger = new Logger();

function init() {
	logger.info("initialized");
}`,
				options: [{ classes: { Logger: "@company/logging" } }],
			},
			// Not a tracked class
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { SomeOther } from "some-package";

function init() {
	const other = new SomeOther();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Different import source - not tracked
			{
				code: `
import Log from "@other/log-library";

function init() {
	const log = new Log();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Empty config
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function init() {
	const log = new Log();
}`,
				options: [{ classes: {} }],
			},
			// No options provided
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function init() {
	const log = new Log();
}`,
			},
			// Class with same name but different source
			{
				code: `
import { Log } from "@different/package";

function init() {
	const log = new Log();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			// Multiple tracked classes - all at module level
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { Server } from "@rbxts/net";

const log = new Log();
const server = new Server();

function setup() {
	log.Info("setup");
	server.start();
}`,
				options: [
					{
						classes: {
							Log: "@rbxts/rbxts-sleitnick-log",
							Server: "@rbxts/net",
						},
					},
				],
			},
			// Script sourceType (global scope is fine)
			{
				code: `
const log = new Log();
`,
				languageOptions: {
					sourceType: "script",
				},
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
		],
	});
});
