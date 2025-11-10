import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/require-paired-calls";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("require-paired-calls", () => {
	ruleTester.run("require-paired-calls", rule, {
		invalid: [
			// Basic unpaired opener
			{
				code: `
					function test() {
						debug.profilebegin("task");
						doWork();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Unpaired closer (no opener)
			{
				code: `
					function test() {
						doWork();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedCloser" }],
			},

			// Missing closer on early return
			{
				code: `
					function test() {
						debug.profilebegin("task");
						if (error) return;
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Missing closer on throw
			{
				code: `
					function test() {
						debug.profilebegin("task");
						if (error) throw new Error("fail");
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Missing closer in try block (exception path)
			{
				code: `
					function test() {
						debug.profilebegin("task");
						try {
							riskyOperation();
							debug.profileend();
						} catch (e) {
							handleError(e);
						}
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Break skips closer
			{
				code: `
					function test() {
						debug.profilebegin("loop");
						for (const item of items) {
							if (item.stop) break;
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Continue skips closer
			{
				code: `
					function test() {
						debug.profilebegin("loop");
						for (const item of items) {
							if (item.skip) continue;
							process(item);
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Wrong LIFO order
			{
				code: `
					function test() {
						debug.profilebegin("a");
						debug.profilebegin("b");
						debug.profileend(); // closes b
						// a is still open at function exit
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Multiple consecutive openers (when disallowed)
			{
				code: `
					function test() {
						debug.profilebegin("task");
						debug.profilebegin("task");
						debug.profileend();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "multipleOpeners" }],
				options: [
					{
						allowMultipleOpeners: false,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Too many closers
			{
				code: `
					function test() {
						debug.profilebegin("task");
						debug.profileend();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedCloser" }],
			},

			// Await with requireSync: true
			{
				code: `
					async function test() {
						debug.profilebegin("task");
						await fetch("/api");
						debug.profileend();
					}
				`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Yield with requireSync: true
			{
				code: `
					function* test() {
						debug.profilebegin("task");
						yield 1;
						debug.profileend();
					}
				`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// For-await-of with requireSync: true
			{
				code: `
					async function test() {
						debug.profilebegin("task");
						for await (const item of asyncIterable) {
							process(item);
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Roblox yielding function auto-closes profiles
			{
				code: `
					function test() {
						debug.profilebegin("task");
						task.wait(1);
						debug.profileend();
					}
				`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Roblox wait() function
			{
				code: `
					function test() {
						debug.profilebegin("task");
						wait(1);
						debug.profileend();
					}
				`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Roblox WaitForChild method
			{
				code: `
					function test() {
						debug.profilebegin("task");
						const part = workspace.WaitForChild("Part");
						debug.profileend();
					}
				`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Nested profiles both auto-closed by yielding
			{
				code: `
					function test() {
						debug.profilebegin("outer");
						debug.profilebegin("inner");
						task.wait(0.1);
						debug.profileend();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "robloxYieldViolation" }, { messageId: "unpairedCloser" }],
			},

			// Conditional opener without guaranteed closer
			{
				code: `
					function test() {
						if (shouldProfile) {
							debug.profilebegin("task");
						}
						doWork();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedCloser" }],
			},

			// Switch without closer in all branches
			{
				code: `
					function test(val) {
						debug.profilebegin("switch");
						switch (val) {
							case 1:
								debug.profileend();
								break;
							case 2:
								return; // missing closer
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Max nesting depth exceeded
			{
				code: `
					function test() {
						debug.profilebegin("a");
						debug.profilebegin("b");
						debug.profilebegin("c");
						debug.profileend();
						debug.profileend();
						debug.profileend();
					}
				`,
				errors: [{ messageId: "maxNestingExceeded" }],
				options: [
					{
						maxNestingDepth: 2,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Missing closer in if branch
			{
				code: `
					function test() {
						debug.profilebegin("task");
						if (condition1) {
							debug.profileend();
						} else if (condition2) {
							debug.profileend();
						}
						// No closer if both conditions false
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Async generator with yield
			{
				code: `
					async function* test() {
						debug.profilebegin("task");
						yield 1;
						debug.profileend();
					}
				`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Return in loop body with opener before loop
			{
				code: `
					function test() {
						debug.profilebegin("task");
						for (const item of items) {
							if (item.found) return item;
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Throw in loop body with opener before loop
			{
				code: `
					function test() {
						debug.profilebegin("task");
						for (const item of items) {
							if (item.bad) throw new Error("bad");
						}
						debug.profileend();
					}
				`,
				errors: [{ messageId: "unpairedOpener" }],
			},
		],
		valid: [
			// Basic pairing - valid
			{
				code: `
					function test() {
						debug.profilebegin("task");
						doWork();
						debug.profileend();
					}
				`,
			},

			// Nested pairs - valid LIFO order
			{
				code: `
					function test() {
						debug.profilebegin("outer");
						debug.profilebegin("inner");
						debug.profileend(); // closes inner
						debug.profileend(); // closes outer
					}
				`,
			},

			// Try-finally - closer guaranteed
			{
				code: `
					function test() {
						debug.profilebegin("task");
						try {
							riskyOperation();
						} finally {
							debug.profileend();
						}
					}
				`,
			},

			// Try-catch with closers in both branches
			{
				code: `
					function test() {
						debug.profilebegin("task");
						try {
							riskyOperation();
							debug.profileend();
						} catch (e) {
							debug.profileend();
							throw e;
						}
					}
				`,
			},

			// Conditional closer in both branches
			{
				code: `
					function test() {
						debug.profilebegin("task");
						if (condition) {
							debug.profileend();
						} else {
							debug.profileend();
						}
					}
				`,
			},

			// Loop with pairs inside iteration
			{
				code: `
					function test() {
						for (const item of items) {
							debug.profilebegin("item");
							process(item);
							debug.profileend();
						}
					}
				`,
			},

			// Normal loop completion (no breaks/continues)
			{
				code: `
					function test() {
						debug.profilebegin("loop");
						for (let i = 0; i < 10; i++) {
							doWork(i);
						}
						debug.profileend();
					}
				`,
			},

			// Separate functions have their own scopes
			{
				code: `
					function outer() {
						debug.profilebegin("outer");
						inner();
						debug.profileend();
					}

					function inner() {
						debug.profilebegin("inner");
						doWork();
						debug.profileend();
					}
				`,
			},

			// Callbacks have separate scopes
			{
				code: `
					function test() {
						debug.profilebegin("outer");
						items.forEach(item => {
							debug.profilebegin("inner");
							process(item);
							debug.profileend();
						});
						debug.profileend();
					}
				`,
			},

			// Switch with closers in all branches
			{
				code: `
					function test(val) {
						switch (val) {
							case 1:
								debug.profilebegin("one");
								doWork();
								debug.profileend();
								break;
							case 2:
								debug.profilebegin("two");
								doWork();
								debug.profileend();
								break;
							default:
								debug.profilebegin("default");
								doWork();
								debug.profileend();
						}
					}
				`,
			},

			// No paired calls at all
			{
				code: `
					function test() {
						doWork();
						return 42;
					}
				`,
			},

			// Custom pair configuration
			{
				code: `
					function test() {
						db.transaction();
						try {
							db.users.insert({ name: "test" });
							db.commit();
						} catch (err) {
							db.rollback();
							throw err;
						}
					}
				`,
				options: [
					{
						pairs: [
							{
								alternatives: ["db.rollback"],
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
						],
					},
				],
			},

			// Array closers
			{
				code: `
					function test() {
						lock.acquire();
						doWork();
						lock.release();
					}
				`,
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},
		],
	});
});
