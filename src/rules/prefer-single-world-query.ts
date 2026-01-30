import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferSingleGet" | "preferSingleHas";
type QueryType = "get" | "has";

interface WorldQueryCall {
	readonly componentNode: TSESTree.Expression;
	readonly entityNode: TSESTree.Expression;
	readonly node: TSESTree.CallExpression;
	readonly queryType: QueryType;
	readonly variableDeclaration: TSESTree.VariableDeclaration;
	readonly variableDeclarator: TSESTree.VariableDeclarator;
	readonly variableName: string;
	readonly worldNode: TSESTree.Expression;
}

interface GroupedCall {
	readonly calls: ReadonlyArray<WorldQueryCall>;
	readonly entityText: string;
	readonly queryType: QueryType;
	readonly worldText: string;
}

function isWorldQueryCall(node: TSESTree.Node, queryType: QueryType): node is TSESTree.CallExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;

	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.name !== queryType) return false;

	if (node.arguments.length !== 2) return false;
	const [entity, component] = node.arguments;
	if (!entity || entity.type === AST_NODE_TYPES.SpreadElement) return false;
	if (!component || component.type === AST_NODE_TYPES.SpreadElement) return false;

	return true;
}

function extractWorldQueryCall(
	node: TSESTree.VariableDeclaration,
	queryType: QueryType,
): WorldQueryCall | undefined {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;
	if (!declarator) return undefined;

	const { id, init } = declarator;
	if (id.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (!init) return undefined;
	if (!isWorldQueryCall(init, queryType)) return undefined;

	const callee = init.callee as TSESTree.MemberExpression;
	const [entityNode, componentNode] = init.arguments;

	if (!entityNode || entityNode.type === AST_NODE_TYPES.SpreadElement) return undefined;
	if (!componentNode || componentNode.type === AST_NODE_TYPES.SpreadElement) return undefined;

	return {
		componentNode,
		entityNode,
		node: init,
		queryType,
		variableDeclaration: node,
		variableDeclarator: declarator,
		variableName: id.name,
		worldNode: callee.object,
	};
}

function getNodeText(node: TSESTree.Node, { sourceCode }: { readonly sourceCode: TSESLint.SourceCode }): string {
	return sourceCode.getText(node);
}

function getGroupKey(call: WorldQueryCall, context: TSESLint.RuleContext<MessageIds, []>): string {
	const worldText = getNodeText(call.worldNode, context);
	const entityText = getNodeText(call.entityNode, context);
	return `${call.queryType}::${worldText}::${entityText}`;
}

function groupCalls(
	calls: ReadonlyArray<WorldQueryCall>,
	context: TSESLint.RuleContext<MessageIds, []>,
): ReadonlyArray<GroupedCall> {
	const groups = new Map<string, GroupedCall>();

	for (const call of calls) {
		const key = getGroupKey(call, context);
		const existing = groups.get(key);
		const worldText = getNodeText(call.worldNode, context);
		const entityText = getNodeText(call.entityNode, context);

		if (existing) {
			groups.set(key, { ...existing, calls: [...existing.calls, call] });
		} else {
			groups.set(key, {
				calls: [call],
				entityText,
				queryType: call.queryType,
				worldText,
			});
		}
	}

	return [...groups.values()].filter((group) => group.calls.length >= 2);
}

function isIdentifierDirectlyInAndExpression(node: TSESTree.Identifier): boolean {
	const { parent } = node;
	if (!parent) return false;

	// Check if parent is a LogicalExpression with &&
	if (parent.type === AST_NODE_TYPES.LogicalExpression && parent.operator === "&&") {
		return true;
	}

	// Check if we're inside a test of IfStatement, WhileStatement, etc.
	if (
		parent.type === AST_NODE_TYPES.IfStatement ||
		parent.type === AST_NODE_TYPES.WhileStatement ||
		parent.type === AST_NODE_TYPES.DoWhileStatement ||
		parent.type === AST_NODE_TYPES.ForStatement ||
		parent.type === AST_NODE_TYPES.ConditionalExpression
	) {
		// Check if the identifier is in a && chain within the test
		let current: TSESTree.Node | undefined = node;
		while (current && current !== parent) {
			if (
				current.parent?.type === AST_NODE_TYPES.LogicalExpression &&
				current.parent.operator === "&&"
			) {
				return true;
			}
			current = current.parent;
		}
	}

	return false;
}

function checkVariableUsedInAndExpression(
	variableName: string,
	variableDeclaration: TSESTree.VariableDeclaration,
	sourceCode: TSESLint.SourceCode,
): boolean {
	const scope = sourceCode.getScope(variableDeclaration) as TSESLint.Scope.Scope | undefined;
	if (!scope) return false;

	// Find the variable in this scope
	const variable = scope.variables.find((scopeVariable) => scopeVariable.name === variableName);
	if (!variable) return false;

	// Check all references to this variable
	for (const ref of variable.references) {
		// Skip the declaration itself (write reference)
		if (ref.isWrite()) continue;
		// Only check standard identifiers, not JSXIdentifier
		if (ref.identifier.type !== AST_NODE_TYPES.Identifier) continue;
		if (isIdentifierDirectlyInAndExpression(ref.identifier)) return true;
	}
	return false;
}

function areAllVariablesUsedInAndExpressions(
	calls: ReadonlyArray<WorldQueryCall>,
	{ sourceCode }: { readonly sourceCode: TSESLint.SourceCode },
): boolean {
	for (const call of calls) {
		if (!checkVariableUsedInAndExpression(call.variableName, call.variableDeclaration, sourceCode)) {
			return false;
		}
	}
	return true;
}

function getVariableName(call: WorldQueryCall): string {
	return call.variableName;
}

function generateHasFixCode(group: GroupedCall, context: TSESLint.RuleContext<MessageIds, []>): string {
	const { worldText, entityText, calls } = group;
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));
	const componentArguments = componentTexts.join(", ");

	return `${worldText}.has(${entityText}, ${componentArguments})`;
}

function generateGetFixCode(group: GroupedCall, context: TSESLint.RuleContext<MessageIds, []>): string {
	const { worldText, entityText, calls } = group;
	const variableNames = calls.map((call) => getVariableName(call));
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));

	const destructuring = variableNames.length === 1 ? variableNames[0] : `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");

	return `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;
}

export default createRule<[], MessageIds>({
	create(context) {
		const worldGetCalls = new Array<WorldQueryCall>();
		const worldHasCalls = new Array<WorldQueryCall>();
		let getSize = 0;
		let hasSize = 0;

		return {
			"Program:exit"(): void {
				if (getSize >= 2) {
					const getGroups = groupCalls(worldGetCalls.slice(0, getSize), context);
					for (const group of getGroups) {
						const { calls } = group;
						const [firstCall] = calls;
						if (!firstCall) continue;

						const sortedCalls = [...calls].toSorted((a, b) => {
							const positionA = a.variableDeclaration.range?.[0] ?? 0;
							const positionB = b.variableDeclaration.range?.[0] ?? 0;
							return positionA - positionB;
						});

						const firstDeclaration = sortedCalls.at(0)?.variableDeclaration;
						const lastDeclaration = sortedCalls.at(-1)?.variableDeclaration;
						if (!(firstDeclaration && lastDeclaration)) continue;

						const fixedCode = generateGetFixCode({ ...group, calls: sortedCalls }, context);

						context.report({
							fix(fixer) {
								const rangeStart = firstDeclaration.range?.[0] ?? 0;
								const rangeEnd = lastDeclaration.range?.[1] ?? 0;
								return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
							},
							messageId: "preferSingleGet",
							node: firstCall.node,
						});
					}
				}

				if (hasSize >= 2) {
					const hasGroups = groupCalls(worldHasCalls.slice(0, hasSize), context);
					for (const group of hasGroups) {
						const { calls } = group;
						const [firstCall] = calls;
						if (!firstCall) continue;

						// Only combine has() calls if they're used in && expressions
						if (!areAllVariablesUsedInAndExpressions(calls, context)) continue;

						const sortedCalls = [...calls].toSorted((a, b) => {
							const positionA = a.variableDeclaration.range?.[0] ?? 0;
							const positionB = b.variableDeclaration.range?.[0] ?? 0;
							return positionA - positionB;
						});

						const firstDeclaration = sortedCalls.at(0)?.variableDeclaration;
						const lastDeclaration = sortedCalls.at(-1)?.variableDeclaration;
						if (!(firstDeclaration && lastDeclaration)) continue;

						const hasCallCode = generateHasFixCode({ ...group, calls: sortedCalls }, context);
						const newVariableName = "hasAll";

						context.report({
							fix(fixer) {
								const rangeStart = firstDeclaration.range?.[0] ?? 0;
								const rangeEnd = lastDeclaration.range?.[1] ?? 0;
								return fixer.replaceTextRange(
									[rangeStart, rangeEnd],
									`const ${newVariableName} = ${hasCallCode};`,
								);
							},
							messageId: "preferSingleHas",
							node: firstCall.node,
						});
					}
				}
			},
			"VariableDeclaration[kind='const']"(node: TSESTree.VariableDeclaration): void {
				const getCall = extractWorldQueryCall(node, "get");
				if (getCall) {
					worldGetCalls[getSize++] = getCall;
					return;
				}

				const hasCall = extractWorldQueryCall(node, "has");
				if (hasCall) worldHasCalls[hasSize++] = hasCall;
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce combining multiple world.get() or world.has() calls into a single call for better Jecs performance.",
		},
		fixable: "code",
		messages: {
			preferSingleGet:
				"Multiple world.get() calls on the same entity should be combined into a single call for better performance.",
			preferSingleHas:
				"Multiple world.has() calls on the same entity should be combined into a single call for better performance.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-single-world-query",
});
