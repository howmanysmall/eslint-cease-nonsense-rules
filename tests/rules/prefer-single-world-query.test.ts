import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/prefer-single-world-query";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

describe("prefer-single-world-query", () => {
	//@ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ruleTester.run("prefer-single-world-query", rule, {
		invalid: [
			// Basic get case: two world.get calls on same world and entity
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entity, ComponentA, ComponentB);
`,
			},
			// Three get components
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB, componentC] = world.get(entity, ComponentA, ComponentB, ComponentC);
`,
			},
			// Four get components (max for Jecs)
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
const componentD = world.get(entity, ComponentD);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB, componentC, componentD] = world.get(entity, ComponentA, ComponentB, ComponentC, ComponentD);
`,
			},
			// Method call on world object
			{
				code: `
const componentA = this.world.get(entity, ComponentA);
const componentB = this.world.get(entity, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = this.world.get(entity, ComponentA, ComponentB);
`,
			},
			// Multiple different entities (should only group matching entity)
			{
				code: `
const componentA = world.get(entityA, ComponentA);
const componentB = world.get(entityA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entityA, ComponentA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
			},
			// Complex expression as entity
			{
				code: `
const componentA = world.get(entities[0], ComponentA);
const componentB = world.get(entities[0], ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entities[0], ComponentA, ComponentB);
`,
			},
			// Has() calls combined in && expression
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
if (hasA && hasB) { doSomething(); }
`,
			},
			// Three has() calls in &&
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const hasC = world.has(entity, ComponentC);
if (hasA && hasB && hasC) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB, ComponentC);
if (hasA && hasB && hasC) { doSomething(); }
`,
			},
			// Has() in while loop condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
while (hasA && hasB) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
while (hasA && hasB) { doSomething(); }
`,
			},
			// Has() in ternary
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const result = hasA && hasB ? "yes" : "no";
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
const result = hasA && hasB ? "yes" : "no";
`,
			},
		],
		valid: [
			// Single world.get call (nothing to optimize)
			{
				code: "const componentA = world.get(entity, ComponentA);",
			},
			// Different worlds
			{
				code: `
const componentA = worldA.get(entity, ComponentA);
const componentB = worldB.get(entity, ComponentB);
`,
			},
			// Different entities
			{
				code: `
const componentA = world.get(entityA, ComponentA);
const componentB = world.get(entityB, ComponentB);
`,
			},
			// Not a call expression
			{
				code: "const componentA = world.get;",
			},
			// Wrong number of arguments (not a standard world.get)
			{
				code: "const componentA = world.get(entity);",
			},
			{
				code: "const componentA = world.get(entity, ComponentA, extraArg);",
			},
			// Computed property access
			{
				code: "const componentA = world['get'](entity, ComponentA);",
			},
			// Not const declaration
			{
				code: `
let componentA = world.get(entity, ComponentA);
let componentB = world.get(entity, ComponentB);
`,
			},
			// Array destructuring in declaration
			{
				code: `
const [componentA] = world.get(entity, ComponentA);
const [componentB] = world.get(entity, ComponentB);
`,
			},
			// Object destructuring in declaration
			{
				code: `
const { a } = world.get(entity, ComponentA);
const { b } = world.get(entity, ComponentB);
`,
			},
			// Spread element in arguments
			{
				code: "const componentA = world.get(entity, ...components);",
			},
			// Non-identifier variable name
			{
				code: `
const { x } = world.get(entity, ComponentA);
const { y } = world.get(entity, ComponentB);
`,
			},
			// Has() calls used separately (not in &&)
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA) { doA(); }
if (hasB) { doB(); }
`,
			},
			// Has() calls used in || (not &&)
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA || hasB) { doSomething(); }
`,
			},
			// Has() calls used independently
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const x = hasA;
const y = hasB;
`,
			},
			// Single has() call
			{
				code: "const hasA = world.has(entity, ComponentA);",
			},
		],
	});
});
