import { describe } from "vitest";
import rule from "@rules/no-array-constructor-elements";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

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

describe("no-array-constructor-elements", () => {
	ruleTester.run("no-array-constructor-elements", rule, {
		invalid: [
			{
				code: 'const values = new Array("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const values = new Array<string>("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const value = new Array("a");',
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: 'const value = ["a"];',
			},
			{
				code: "const value = new Array(size);",
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: size });",
							},
						],
					},
				],
				options: [{ environment: "standard" }],
				output: undefined,
			},
			{
				code: "const value = new Array(3);",
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: 3 });",
							},
						],
					},
				],
				options: [{ environment: "standard" }],
				output: undefined,
			},
			{
				code: "const value = new Array(256, -1);",
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
					},
				],
				options: [{ environment: "standard" }],
				output: "const value = [256, -1];",
			},
			{
				code: "const value = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "consume(new Array());",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "const values: Set<string> = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "const values: Collections.Array<string> = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "const values: Array = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "function build(values = new Array()) { return values; }",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "class Example { values = new Array(); }",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "const values = new Array() as Set<string>;",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: undefined,
			},
			{
				code: "const values = <Set<string>>new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				languageOptions: {
					parserOptions: {
						ecmaFeatures: {
							jsx: false,
						},
					},
				},
				output: undefined,
			},
			{
				code: 'const values = new Array(void value, "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = [void value, "b"];',
			},
			{
				code: 'const values = new Array("a", ...items);',
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
						suggestions: [
							{
								messageId: "suggestArrayLiteral",
								output: 'const values = ["a", ...items];',
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: "const values = new Array(...items);",
				errors: [
					{
						messageId: "avoidSingleArgumentConstructor",
						suggestions: [
							{
								messageId: "suggestArrayLiteral",
								output: "const values = [...items];",
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: "const value = new Array(`label`);",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [`label`];",
			},
			{
				code: "const value = new Array({ label: value });",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [{ label: value }];",
			},
			{
				code: `
const array = new Array<string>();
array.push("a");
array.push("b");
array.push("c", "d", "e", "f");
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = ["a", "b", "c", "d", "e", "f"];
`,
			},
			{
				code: `
const array = new Array<string>();
array.push(getValue());
array.push("b");
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [getValue(), "b"];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push(void value, object[key], condition ? left : right, \`\${label}\`, [first, second], { [key]: value });
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = [void value, object[key], condition ? left : right, \`\${label}\`, [first, second], { [key]: value }];
`,
			},
			{
				code: `
const array = new Array<string>();
array.push((first, second));
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = [first, second];
`,
			},
			{
				code: `
const array = new Array<string | undefined>();
array.push([first, , second]);
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = [[first, , second]];
`,
			},
			{
				code: `
const array = new Array<number>();
array.push(value + getValue());
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [value + getValue()];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<object>();
array.push({ [getKey()]: value });
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [{ [getKey()]: value }];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<object>();
array.push({ value() { return value; } });
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [{ value() { return value; } }];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<object>();
array.push(new Value(), tag\`value\`);
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [new Value(), tag\`value\`];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push(getObject().value);
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [getObject().value];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push(condition ? getLeft() : right);
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [condition ? getLeft() : right];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push(\`value: \${getValue()}\`);
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [\`value: \${getValue()}\`];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<object>();
array.push({ get value() { return value; } });
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [{ get value() { return value; } }];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<() => void>();
array.push(() => {});
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [() => {}];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
function build(items: Array<string>) {
	const array = new Array<string>();
		array.push(...items);
}
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
function build(items: Array<string>) {
	const array = [...items];
}
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
const array = new Array<string>();
array.push(object?.value, delete target.value, [...items], { ...source }, import.meta);
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [object?.value, delete target.value, [...items], { ...source }, import.meta];
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
class Example {
	#value = 1;

	build(other: object) {
		const array = new Array<boolean>();
		array.push(#value in other);
	}
}
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
class Example {
	#value = 1;

	build(other: object) {
		const array = [#value in other];
	}
}
`,
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: `
class Base {
	value = "base";
}

class Example extends Base {
	build() {
		const array = new Array<string>();
		array.push(super.value);
	}
}
`,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
class Base {
	value = "base";
}

class Example extends Base {
	build() {
		const array = [super.value];
	}
}
`,
							},
						],
					},
				],
				output: undefined,
			},
		],
		valid: [
			"const value = new Array<string>();",
			"const value: Array<string> = new Array();",
			"const sized = new Array(10);",
			{
				code: "const sized = new Array(10);",
				options: [{ environment: "roblox-ts" }],
			},
			`
type ColorSequenceKeypoint = { time: number };
declare const length: number;
const keypoints = new Array<ColorSequenceKeypoint>(length);
`,
			`
type ColorSequenceKeypoint = { time: number };
const keypoints = new Array<ColorSequenceKeypoint>(256, -1);
`,
			`
function multiplyByTwo(array: ReadonlyArray<number>): ReadonlyArray<number> {
    const newArray = new Array<number>(array.size());
    let size = 0;

    for (const value of array) newArray[size++] = value * 2;
    return newArray;
}
`,
			{
				code: "const value = new Array();",
				options: [{ requireExplicitGenericOnNewArray: false }],
			},
			"function build(values: Array<string> = new Array()) { return values; }",
			"const [value]: Array<string> = new Array();",
			"const {}: Array<string> = new Array();",
			"class Example { values: Array<string> = new Array(); }",
			"const values = new Array() as Array<string>;",
			"const values: ReadonlyArray<string> = new Array();",
			`
const array: ReadonlyArray<string> = new Array();
array.push("a");
`,
			`
var array = new Array<string>();
array.push("a");
`,
			`
const first = new Array<string>(), second = 1;
first.push("a");
`,
			`
const array = createArray<string>();
array.push("a");
`,
			`
const array = new Array<string>(size);
array.push("a");
`,
			`
const array = new Array<string>();
array.push?.("a");
`,
			`
const array = new Array<string>();
array.slice("a");
`,
			`
const array = new Array<string>();
array.push();
`,
			{
				code: "const values = <Array<string>>new Array();",
				languageOptions: {
					parserOptions: {
						ecmaFeatures: {
							jsx: false,
						},
					},
				},
			},
			`
class Array<TValue> {
    constructor(..._arguments: Array<TValue>) {}
}
const value = new Array("a");
`,
			`
const array = new Array<string>();
array.push("a");
doSomething(array);
array.push("b");
`,
			`
const array = new Array<string>();
other.push("a");
array.push("b");
`,
		],
	});
});
