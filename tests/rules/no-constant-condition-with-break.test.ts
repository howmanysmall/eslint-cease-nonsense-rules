import { describe } from "vitest";
import rule from "@rules/no-constant-condition-with-break";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-constant-condition-with-break", () => {
	// @ts-expect-error - RuleTester doesn't support the new format of rules
	ruleTester.run("no-constant-condition-with-break", rule, {
		invalid: [
			{
				code: "if (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ([]) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ({}) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (() => value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (undefined) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (NaN) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (Infinity) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (`static`) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (typeof value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (void value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (-1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (~1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ((value, true)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (condition ? true : true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (null ?? true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (false && value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (true && 1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (true || value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (false || 1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ('value' ?? fallback) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (true ? false : condition) { doThing(); }",
				errors: [{ messageId: "unexpected" }, { messageId: "unexpected" }],
			},
			{
				code: "if (+(0 && value)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+(true && 1)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+(1 || value)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+(false || 1)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+(1 ?? fallback)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+(null ?? 1)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (!0) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (+((value, 1))) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "const value = true ? 1 : 2;",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "for (; 1;) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { if (done) continue; doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { switch (value) { case 1: break; default: doThing(); } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { const stop = () => { return; }; stop(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { coroutine.yield(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { task.wait(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (true) { const pause = () => coroutine.yield(); pause(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (false) { break; }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "do { doThing(); } while (0);",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { label: { break label; } doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { do { break; } while (condition); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { for (;;) { break; } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { for (const key in values) { break; } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { for (const value of values) { break; } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { while (condition) { break; } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { try { doThing(); } catch (error) { handle(error); } finally { cleanup(); } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { task[wait](); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { const exits = [items]; doThing(exits); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { new Factory(value); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { ({}).wait(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "function* run() { while (true) { yield; doThing(); } }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { let value; doThing(value); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["task.wait"] }],
			},
		],
		valid: [
			"if (condition) { doThing(); }",
			"if (+value) { doThing(); }",
			"if (+(value && 1)) { doThing(); }",
			"if (~value) { doThing(); }",
			"if (delete value.property) { doThing(); }",
			"if (condition && true) { doThing(); }",
			"if (condition ?? true) { doThing(); }",
			"if ((condition ? 1 : 2) ?? true) { doThing(); }",
			"if (condition ? true : false) { doThing(); }",
			"for (;;) { doThing(); }",
			"while (true) { if (done) break; doThing(); }",
			"for (; true;) { if (done) break; doThing(); }",
			"outer: while (true) { if (done) break outer; doThing(); }",
			"function run() { while (true) { if (done) return; doThing(); } }",
			"function run() { while (true) { switch (value) { case 1: return; default: doThing(); } } }",
			"while (value) { doThing(); }",
			{
				code: "while (true) { coroutine.yield(); doThing(); }",
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (true) { task.wait(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { const exits = [task.wait()]; doThing(exits); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { const exits = [, task.wait()]; doThing(exits); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { const exits = [...task.wait()]; doThing(exits); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { const exits = [...items, task.wait()]; doThing(exits); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { state.next = task.wait(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "async function run() { while (true) { await task.wait(); doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { task.wait() + 1; doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { task.wait() || doThing(); doOtherThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { 1 + task.wait(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { doThing() || task.wait(); doOtherThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { maybe ? task.wait() : doThing(); doOtherThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { maybe ? doThing() : task.wait(); doOtherThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { task['wait'](); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { task.wait()(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { helper(...items, task.wait()); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { helper(...task.wait()); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { object[task.wait()]; doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { task.wait().value; doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { new Factory(task.wait()); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { new (task.wait())(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { new Factory(...items, task.wait()); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { new Factory(...task.wait()); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { (task.wait(), doThing()); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { !task.wait(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { counter[task.wait()]++; doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "function* run() { while (true) { yield task.wait(); doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (task.wait()) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "do { doThing(); } while (task.wait());",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (const value = task.wait(); true;) { doThing(value); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (task.wait(); true;) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (; true && task.wait();) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (; task.wait();) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (; true || task.wait();) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (; true; task.wait()) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { do { doThing(); } while (task.wait()); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { for (const key in obj.call()) { doThing(key); } }",
				options: [{ loopExitCalls: ["obj.call"] }],
			},
			{
				code: "while (true) { for (const value of obj.call()) { doThing(value); } }",
				options: [{ loopExitCalls: ["obj.call"] }],
			},
			{
				code: "while (true) { for (; maybeContinue; task.wait()) { doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { for (task.wait(); maybeContinue;) { doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { for (let index; maybeContinue; task.wait()) { doThing(index); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { for (; task.wait();) { doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			"while (true) { if (done) { doThing(); } else { break; } }",
			"while (true) { label: { break; } }",
			"while (true) { try { break; } catch (error) { doThing(error); } }",
			"while (true) { try { doThing(); } catch (error) { break; } }",
			"while (true) { try { doThing(); } finally { break; } }",
			{
				code: "while (true) { while (task.wait()) { doThing(); } }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { with (task.wait()) { doThing(); } }",
				languageOptions: {
					ecmaVersion: 2022,
					sourceType: "script",
				},
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "while (true) { with (context) { break; } }",
				languageOptions: {
					ecmaVersion: 2022,
					sourceType: "script",
				},
			},
		],
	});
});
