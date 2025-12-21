import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";

export interface NoGodComponentsOptions {
	readonly targetLines?: number;
	readonly maxLines?: number;
	readonly enforceTargetLines?: boolean;
	readonly maxTsxNesting?: number;
	readonly maxStateHooks?: number;
	readonly stateHooks?: ReadonlyArray<string>;
	readonly maxDestructuredProps?: number;
	readonly ignoreComponents?: ReadonlyArray<string>;
}

const COMPONENT_NAME_PATTERN = /^[A-Z]/;

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

function getComponentNameFromFunction(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): string | undefined {
	if (node.type === TSESTree.AST_NODE_TYPES.FunctionDeclaration && node.id && isComponentName(node.id.name)) {
		return node.id.name;
	}

	if (
		node.type === TSESTree.AST_NODE_TYPES.FunctionExpression ||
		node.type === TSESTree.AST_NODE_TYPES.ArrowFunctionExpression
	) {
		const { parent } = node;
		if (parent === null || parent === undefined) return undefined;

		if (
			parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
			parent.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
			isComponentName(parent.id.name)
		) {
			return parent.id.name;
		}

		if (
			parent.type === TSESTree.AST_NODE_TYPES.Property &&
			parent.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
			isComponentName(parent.key.name)
		) {
			return parent.key.name;
		}

		if (
			parent.type === TSESTree.AST_NODE_TYPES.MethodDefinition &&
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
	if (parent === null || parent === undefined) return undefined;

	if (
		parent.type === TSESTree.AST_NODE_TYPES.VariableDeclarator &&
		parent.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
		isComponentName(parent.id.name)
	) {
		return parent.id.name;
	}

	if (
		parent.type === TSESTree.AST_NODE_TYPES.AssignmentExpression &&
		parent.left.type === TSESTree.AST_NODE_TYPES.Identifier &&
		isComponentName(parent.left.name)
	) {
		return parent.left.name;
	}

	let nameFromExportDefault: string | undefined;
	if (parent.type === TSESTree.AST_NODE_TYPES.ExportDefaultDeclaration && callExpr.arguments.length > 0) {
		const [firstArg] = callExpr.arguments;
		if (
			firstArg &&
			firstArg.type === TSESTree.AST_NODE_TYPES.FunctionExpression &&
			firstArg.id &&
			isComponentName(firstArg.id.name)
		) {
			nameFromExportDefault = firstArg.id.name;
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

function countDestructuredProps(
	node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): number | undefined {
	const [firstParam] = node.params;
	if (!firstParam) return undefined;

	let pattern: TSESTree.ObjectPattern | undefined;
	if (firstParam.type === TSESTree.AST_NODE_TYPES.ObjectPattern) pattern = firstParam;
	if (
		firstParam.type === TSESTree.AST_NODE_TYPES.AssignmentPattern &&
		firstParam.left.type === TSESTree.AST_NODE_TYPES.ObjectPattern
	) {
		pattern = firstParam.left;
	}

	if (!pattern) return undefined;

	let count = 0;
	for (const { type } of pattern.properties) if (type === TSESTree.AST_NODE_TYPES.Property) count += 1;

	return count;
}

function isTypeOnlyNullLiteral(node: TSESTree.Literal): boolean {
	const { parent } = node;
	if (parent === null || parent === undefined) return false;

	return parent.type === TSESTree.AST_NODE_TYPES.TSLiteralType;
}

interface BodyAnalysis {
	readonly maxJsxDepth: number;
	readonly stateHookCount: number;
	readonly nullLiterals: ReadonlyArray<TSESTree.Literal>;
}

function analyzeComponentBody(
	functionNode: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
	sourceCode: Rule.RuleContext["sourceCode"],
	stateHooks: Set<string>,
): BodyAnalysis {
	let maxJsxDepth = 0;
	let stateHookCount = 0;
	const nullLiterals = new Array<TSESTree.Literal>();

	function visit(current: TSESTree.Node, jsxDepth: number): void {
		if (FUNCTION_BOUNDARIES.has(current.type) && current !== functionNode) return;

		let nextDepth = jsxDepth;
		if (
			current.type === TSESTree.AST_NODE_TYPES.JSXElement ||
			current.type === TSESTree.AST_NODE_TYPES.JSXFragment
		) {
			nextDepth = jsxDepth + 1;
			if (nextDepth > maxJsxDepth) maxJsxDepth = nextDepth;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.CallExpression) {
			const hookName = getHookName(current);
			if (typeof hookName === "string" && hookName.length > 0 && stateHooks.has(hookName)) stateHookCount += 1;
		}

		if (current.type === TSESTree.AST_NODE_TYPES.Literal && current.value === null) {
			const literalNode = current as TSESTree.Literal;
			if (!isTypeOnlyNullLiteral(literalNode)) nullLiterals.push(literalNode);
		}

		function getVisitorKeysForNodeType(nodeType: string): ReadonlyArray<string> {
			const keys = new Array<string>();
			const keysUnknown = sourceCode.visitorKeys[nodeType];
			if (!Array.isArray(keysUnknown)) return keys;
			for (const key of keysUnknown) if (typeof key === "string") keys.push(key);
			return keys;
		}

		const keys = getVisitorKeysForNodeType(current.type);
		const currentRecord = current as unknown as Record<string, unknown>;

		for (const key of keys) {
			const value = currentRecord[key];
			if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item !== "object" || item === null) continue;
					if ("type" in item) visit(item as TSESTree.Node, nextDepth);
				}
				continue;
			}

			if (typeof value === "object" && value !== null && "type" in value) {
				visit(value as TSESTree.Node, nextDepth);
			}
		}
	}

	visit(functionNode.body, 0);

	return { maxJsxDepth, nullLiterals, stateHookCount };
}

function parseOptions(options: unknown): Required<NoGodComponentsOptions> {
	const defaults: Required<NoGodComponentsOptions> = {
		enforceTargetLines: true,
		ignoreComponents: [],
		maxDestructuredProps: 5,
		maxLines: 200,
		maxStateHooks: 5,
		maxTsxNesting: 3,
		stateHooks: ["useState", "useReducer", "useBinding"],
		targetLines: 120,
	};

	if (typeof options !== "object" || options === null) return defaults;

	const cast = options as NoGodComponentsOptions;
	return {
		enforceTargetLines:
			typeof cast.enforceTargetLines === "boolean" ? cast.enforceTargetLines : defaults.enforceTargetLines,
		ignoreComponents: Array.isArray(cast.ignoreComponents) ? cast.ignoreComponents : defaults.ignoreComponents,
		maxDestructuredProps:
			typeof cast.maxDestructuredProps === "number" ? cast.maxDestructuredProps : defaults.maxDestructuredProps,
		maxLines: typeof cast.maxLines === "number" ? cast.maxLines : defaults.maxLines,
		maxStateHooks: typeof cast.maxStateHooks === "number" ? cast.maxStateHooks : defaults.maxStateHooks,
		maxTsxNesting: typeof cast.maxTsxNesting === "number" ? cast.maxTsxNesting : defaults.maxTsxNesting,
		stateHooks: Array.isArray(cast.stateHooks) ? cast.stateHooks : defaults.stateHooks,
		targetLines: typeof cast.targetLines === "number" ? cast.targetLines : defaults.targetLines,
	};
}

const noGodComponents: Rule.RuleModule = {
	create(context) {
		const configuration = parseOptions(context.options[0]);
		const ignoreSet = new Set(configuration.ignoreComponents);
		const stateHooks = new Set(configuration.stateHooks);
		const checked = new WeakSet<TSESTree.Node>();
		const { sourceCode } = context;

		function checkComponent(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
			name: string,
		): void {
			if (ignoreSet.has(name)) return;
			if (checked.has(node)) return;
			checked.add(node);

			const location = node.loc;
			if (location !== null && location !== undefined) {
				const lines = location.end.line - location.start.line + 1;
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
			}

			const propsCount = countDestructuredProps(node);
			if (typeof propsCount === "number" && propsCount > configuration.maxDestructuredProps) {
				context.report({
					data: { count: propsCount, max: configuration.maxDestructuredProps, name },
					messageId: "tooManyProps",
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

		function maybeCheckFunction(
			node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
		): void {
			const name = getComponentNameFromFunction(node);
			if (typeof name !== "string" || name.length === 0) return;
			checkComponent(node, name);
		}

		return {
			ArrowFunctionExpression(node) {
				// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
				maybeCheckFunction(node as unknown as TSESTree.ArrowFunctionExpression);
			},
			CallExpression(node) {
				// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
				const callExpr = node as unknown as TSESTree.CallExpression;
				if (!isReactComponentHOC(callExpr)) return;
				const [firstArg] = callExpr.arguments;
				if (
					!firstArg ||
					(firstArg.type !== TSESTree.AST_NODE_TYPES.FunctionExpression &&
						firstArg.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression)
				) {
					return;
				}

				const nameFromParent = getComponentNameFromCallParent(callExpr);
				const nameFromArg = getComponentNameFromFunction(firstArg);
				const name = nameFromParent ?? nameFromArg;
				if (typeof name !== "string" || name.length === 0) return;
				checkComponent(firstArg, name);
			},
			FunctionDeclaration(node) {
				maybeCheckFunction(node as unknown as TSESTree.FunctionDeclaration);
			},
			FunctionExpression(node) {
				maybeCheckFunction(node as unknown as TSESTree.FunctionExpression);
			},
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
			tooManyProps:
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
					maxDestructuredProps: {
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
