import { getDefinedValue } from "$utilities/defined-utilities";
import { TSESTree } from "@typescript-eslint/utils";

import type { Rule } from "eslint";

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
type TraversableNode = TSESTree.Node | TSESTree.BlockStatement | TSESTree.Expression;

export interface NoGodComponentsOptions {
	readonly enforceTargetLines?: boolean;
	readonly ignoreComponents?: ReadonlyArray<string>;
	readonly maxDestructuredProperties?: number;
	readonly maxLines?: number;
	readonly maxStateHooks?: number;
	readonly maxTsxNesting?: number;
	readonly stateHooks?: ReadonlyArray<string>;
	readonly targetLines?: number;
}

const COMPONENT_NAME_PATTERN = /^[A-Z]/u;

const FUNCTION_BOUNDARIES = new Set<TSESTree.AST_NODE_TYPES>([
	TSESTree.AST_NODE_TYPES.FunctionDeclaration,
	TSESTree.AST_NODE_TYPES.FunctionExpression,
	TSESTree.AST_NODE_TYPES.ArrowFunctionExpression,
]);

function isComponentName(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

function isReactComponentHOC(callExpr: TSESTree.CallExpression): boolean {
	const { callee } = callExpr;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) {
		return callee.name === "forwardRef" || callee.name === "memo";
	}

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.object.type === TSESTree.AST_NODE_TYPES.Identifier &&
		callee.object.name === "React" &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return callee.property.name === "forwardRef" || callee.property.name === "memo";
	}

	return false;
}

function getComponentNameFromFunction(node: FunctionNode): string | undefined {
	if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration && node.id && isComponentName(node.id.name)) {
		return node.id.name;
	}

	if (
		node.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
		node.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression
	) {
		const { parent } = node;

		if (
			parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			parent.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
			isComponentName(parent.id.name)
		) {
			return parent.id.name;
		}

		if (
			parent?.type === TSESTree.AST_NODE_TYPES.Property &&
			parent.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
			isComponentName(parent.key.name)
		) {
			return parent.key.name;
		}

		if (
			parent?.type === TSESTree.AST_NODE_TYPES.MethodDefinition &&
			parent.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
			isComponentName(parent.key.name)
		) {
			return parent.key.name;
		}
	}

	return undefined;
}

function getComponentNameFromCallParent(callExpr: TSESTree.CallExpression): string | undefined {
	const { parent } = callExpr;

	if (
		parent?.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
		parent.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
		isComponentName(parent.id.name)
	) {
		return parent.id.name;
	}

	if (
		parent?.type === TSESTree.AST_NODE_TYPES.AssignmentExpression &&
		parent.left.type === TSESTree.AST_NODE_TYPES.Identifier &&
		isComponentName(parent.left.name)
	) {
		return parent.left.name;
	}

	let nameFromExportDefault: string | undefined;
	if (parent?.type === TSESTree.AST_NODE_TYPES.ExportDefaultDeclaration && callExpr.arguments.length > 0) {
		const [firstArgument] = callExpr.arguments;
		if (
			firstArgument &&
			firstArgument.type === TSESTree.AST_NODE_TYPES.FunctionExpression &&
			firstArgument.id &&
			isComponentName(firstArgument.id.name)
		) {
			nameFromExportDefault = firstArgument.id.name;
		}
	}

	return nameFromExportDefault;
}

function getHookName(callExpression: TSESTree.CallExpression): string | undefined {
	const { callee } = callExpression;

	if (callee.type === TSESTree.AST_NODE_TYPES.Identifier) return callee.name;

	if (
		callee.type === TSESTree.AST_NODE_TYPES.MemberExpression &&
		callee.property.type === TSESTree.AST_NODE_TYPES.Identifier
	) {
		return callee.property.name;
	}

	return undefined;
}

function countDestructuredProperties(node: FunctionNode): number | undefined {
	const [firstParameter] = node.params;
	if (!firstParameter) return undefined;

	let pattern: TSESTree.ObjectPattern | undefined;
	if (firstParameter.type === TSESTree.AST_NODE_TYPES.ObjectPattern) pattern = firstParameter;
	if (
		firstParameter.type === TSESTree.AST_NODE_TYPES.AssignmentPattern &&
		firstParameter.left.type === TSESTree.AST_NODE_TYPES.ObjectPattern
	) {
		pattern = firstParameter.left;
	}

	if (!pattern) return undefined;

	return pattern.properties.filter(({ type }) => type === TSESTree.AST_NODE_TYPES.Property).length;
}

function isTypeOnlyNullLiteral(node: TSESTree.Literal): boolean {
	return node.parent?.type === TSESTree.AST_NODE_TYPES.TSLiteralType;
}

function isNode(value: unknown): value is TraversableNode {
	return typeof value === "object" && value !== null && "type" in value;
}

function getPropertyValue(target: object, key: string): unknown {
	return Reflect.get(target, key);
}

function isFunctionNode(value: unknown): value is FunctionNode {
	return (
		isNode(value) &&
		(value.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration ||
			value.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
			value.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression)
	);
}

function isCallExpression(value: unknown): value is TSESTree.CallExpression {
	return isNode(value) && value.type === TSESTree.AST_NODE_TYPES.CallExpression;
}

interface BodyAnalysis {
	readonly maxJsxDepth: number;
	readonly nullLiterals: ReadonlyArray<TSESTree.Literal>;
	readonly stateHookCount: number;
}

function analyzeComponentBody(
	functionNode: FunctionNode,
	sourceCode: Rule.RuleContext["sourceCode"],
	stateHooks: Set<string>,
): BodyAnalysis {
	let maxJsxDepth = 0;
	let stateHookCount = 0;
	const nullLiterals = new Array<TSESTree.Literal>();

	// oxlint-disable-next-line sonar/cognitive-complexity -- lol.
	function visit(current: TraversableNode, jsxDepth: number): void {
		if (FUNCTION_BOUNDARIES.has(current.type) && current !== functionNode) return;

		let nextDepth = jsxDepth;
		if (
			current.type === TSESTree.AST_NODE_TYPES.JSXElement ||
			current.type === TSESTree.AST_NODE_TYPES.JSXFragment
		) {
			nextDepth = jsxDepth + 1;
			maxJsxDepth = Math.max(maxJsxDepth, nextDepth);
		}

		if (current.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			const hookName = getHookName(current);
			if (hookName !== undefined && hookName.length > 0 && stateHooks.has(hookName)) stateHookCount += 1;
		}

		if (
			current.type === TSESTree.AST_NODE_TYPES.Literal &&
			current.value === null &&
			!isTypeOnlyNullLiteral(current)
		) {
			nullLiterals.push(current);
		}

		const keys = getDefinedValue(sourceCode.visitorKeys[current.type], "Expected visitor keys for AST node.");

		for (const key of keys) {
			const value = getPropertyValue(current, key);
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) visit(item, nextDepth);
				continue;
			}

			if (isNode(value)) visit(value, nextDepth);
		}
	}

	visit(functionNode.body, 0);

	return { maxJsxDepth, nullLiterals, stateHookCount };
}

function parseOptions(options: unknown): Required<NoGodComponentsOptions> {
	const defaults: Required<NoGodComponentsOptions> = {
		enforceTargetLines: true,
		ignoreComponents: [],
		maxDestructuredProperties: 5,
		maxLines: 200,
		maxStateHooks: 5,
		maxTsxNesting: 3,
		stateHooks: ["useState", "useReducer", "useBinding"],
		targetLines: 120,
	};

	if (typeof options !== "object" || options === null) return defaults;

	return { ...defaults, ...options };
}

const noGodComponents: Rule.RuleModule = {
	create(context): Rule.RuleListener {
		const configuration = parseOptions(context.options[0]);
		const ignoreSet = new Set(configuration.ignoreComponents);
		const stateHooks = new Set(configuration.stateHooks);
		const checked = new WeakSet<TSESTree.Node>();
		const { sourceCode } = context;

		function checkComponent(node: FunctionNode, name: string): void {
			if (ignoreSet.has(name) || checked.has(node)) return;
			checked.add(node);

			const lines = node.loc.end.line - node.loc.start.line + 1;
			if (lines > configuration.maxLines) {
				context.report({
					data: { lines, max: configuration.maxLines, name, target: configuration.targetLines },
					messageId: "exceedsMaxLines",
					node,
				});
			} else if (configuration.enforceTargetLines && lines > configuration.targetLines) {
				context.report({
					data: { lines, max: configuration.maxLines, name, target: configuration.targetLines },
					messageId: "exceedsTargetLines",
					node,
				});
			}

			const propertiesCount = countDestructuredProperties(node);
			if (typeof propertiesCount === "number" && propertiesCount > configuration.maxDestructuredProperties) {
				context.report({
					data: { count: propertiesCount, max: configuration.maxDestructuredProperties, name },
					messageId: "tooManyProperties",
					node,
				});
			}

			const analysis = analyzeComponentBody(node, sourceCode, stateHooks);

			if (analysis.maxJsxDepth > configuration.maxTsxNesting) {
				context.report({
					data: { depth: analysis.maxJsxDepth, max: configuration.maxTsxNesting, name },
					messageId: "tsxNestingTooDeep",
					node,
				});
			}

			if (analysis.stateHookCount > configuration.maxStateHooks) {
				context.report({
					data: {
						count: analysis.stateHookCount,
						hooks: configuration.stateHooks.join(", "),
						max: configuration.maxStateHooks,
						name,
					},
					messageId: "tooManyStateHooks",
					node,
				});
			}

			for (const literal of analysis.nullLiterals) {
				context.report({
					messageId: "nullLiteral",
					node: literal,
				});
			}
		}

		function maybeCheckFunction(node: unknown): void {
			if (!isFunctionNode(node)) return;
			const name = getComponentNameFromFunction(node);
			if (typeof name !== "string" || name.length === 0) return;
			checkComponent(node, name);
		}

		function checkHigherOrderComponentCall(node: unknown): void {
			if (!(isCallExpression(node) && isReactComponentHOC(node))) return;
			const [firstArgument] = node.arguments;
			if (
				!firstArgument ||
				(firstArgument.type !== TSESTree.AST_NODE_TYPES.FunctionExpression &&
					firstArgument.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression)
			) {
				return;
			}

			const nameFromParent = getComponentNameFromCallParent(node);
			const nameFromArgument = getComponentNameFromFunction(firstArgument);
			const name = nameFromParent ?? nameFromArgument;
			if (typeof name !== "string" || name.length === 0) return;
			checkComponent(firstArgument, name);
		}

		return {
			ArrowFunctionExpression: maybeCheckFunction,
			CallExpression: checkHigherOrderComponentCall,
			FunctionDeclaration: maybeCheckFunction,
			FunctionExpression: maybeCheckFunction,
			Program: maybeCheckFunction,
		};
	},
	meta: {
		docs: {
			description:
				"Enforce React component size and complexity limits inspired by the 'Refactor God Component' checklist.",
			recommended: false,
		},
		messages: {
			exceedsMaxLines:
				"Component '{{name}}' is {{lines}} lines; max allowed is {{max}}. Split into smaller components/hooks.",
			exceedsTargetLines:
				"Component '{{name}}' is {{lines}} lines; target is {{target}} (max {{max}}). Consider extracting hooks/components.",
			nullLiteral: "Avoid `null` in components; use `undefined` instead.",
			tooManyProperties:
				"Component '{{name}}' destructures {{count}} props; max allowed is {{max}}. Group props or split the component.",
			tooManyStateHooks:
				"Component '{{name}}' has {{count}} state hooks ({{hooks}}); max allowed is {{max}}. Extract cohesive state into a custom hook.",
			tsxNestingTooDeep:
				"Component '{{name}}' has TSX nesting depth {{depth}}; max allowed is {{max}}. Extract child components.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					enforceTargetLines: {
						default: true,
						description: "Whether to report when exceeding targetLines (soft limit).",
						type: "boolean",
					},
					ignoreComponents: {
						description: "Component names to ignore.",
						items: { type: "string" },
						type: "array",
					},
					maxDestructuredProperties: {
						default: 5,
						description: "Maximum number of destructured props in a component parameter.",
						type: "number",
					},
					maxLines: {
						default: 200,
						description: "Hard maximum lines for a component.",
						type: "number",
					},
					maxStateHooks: {
						default: 5,
						description: "Maximum number of stateful hook calls in a component.",
						type: "number",
					},
					maxTsxNesting: {
						default: 3,
						description: "Maximum JSX/TSX nesting depth in a component.",
						type: "number",
					},
					stateHooks: {
						default: ["useState", "useReducer", "useBinding"],
						description: "Hook names to count toward state complexity.",
						items: { type: "string" },
						type: "array",
					},
					targetLines: {
						default: 120,
						description: "Soft target lines for a component.",
						type: "number",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
};

export default noGodComponents;
