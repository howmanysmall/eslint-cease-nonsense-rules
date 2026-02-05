import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-array-size-assignment";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

describe("no-array-size-assignment", () => {
	ruleTester.run("no-array-size-assignment", rule, {
		invalid: [
			{
				code: "array[array.size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "array.push(value);",
			},
			{
				code: "state.items[state.items.size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "state.items.push(item);",
			},
			{
				code: 'store["items"][store["items"].size()] = item;',
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: 'store["items"].push(item);',
			},
			{
				code: "registry[keyRef.value][registry[keyRef.value].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "registry[keyRef.value].push(item);",
			},
			{
				code: "registry[keys[index]][registry[keys[index]].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "registry[keys[index]].push(item);",
			},
			{
				code: "class Store { items = []; add(item) { this.items[this.items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "class Store { items = []; add(item) { this.items.push(item); } }",
			},
			{
				code: "class Store { #items = []; add(item) { this.#items[this.#items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "class Store { #items = []; add(item) { this.#items.push(item); } }",
			},
			{
				code: "array[array.size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: false }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "const x = (array[array.size()] = value);",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "getArray()[getArray().size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "registry[getKey().value][registry[getKey().value].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
			{
				code: "class Base { items = []; } class Child extends Base { add(item) { super.items[super.items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				// oxlint-disable-next-line no-null -- RuleTester requires null for no-fix invalid cases
				output: null,
			},
		],
		valid: [
			"array.push(value);",
			"array[array.size() - 1] = value;",
			"array[other.size()] = value;",
			"array[array.size()] += value;",
			'array[array["size"]()] = value;',
			'[item][[item].size()] = item;',
			"store[\"items\"][store['items'].size()] = item;",
		],
	});
});
