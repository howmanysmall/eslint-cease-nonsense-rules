import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utilities/create-rule";

type MessageIds = "preferSingleGet";

interface WorldGetCall {
	readonly componentNode: TSESTree.Expression;
	readonly entityNode: TSESTree.Expression;
	readonly node: TSESTree.CallExpression;
	readonly variableDeclaration: TSESTree.VariableDeclaration;
	readonly variableDeclarator: TSESTree.VariableDeclarator;
	readonly variableName: string;
	readonly worldNode: TSESTree.Expression;
}

interface GroupedCall {
	readonly calls: ReadonlyArray<WorldGetCall>;
	readonly entityText: string;
	readonly worldText: string;
}

function isWorldGetCall(node: TSESTree.Node): node is TSESTree.CallExpression {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;

	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
	if (callee.computed) return false;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
	if (callee.property.name !== "get") return false;

	if (node.arguments.length !== 2) return false;
	const [entity, component] = node.arguments;
	if (!entity || entity.type === AST_NODE_TYPES.SpreadElement) return false;
	if (!component || component.type === AST_NODE_TYPES.SpreadElement) return false;

	return true;
}

function extractWorldGetCall(node: TSESTree.VariableDeclaration): WorldGetCall | undefined {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;
	if (!declarator) return undefined;

	const { id, init } = declarator;
	if (id.type !== AST_NODE_TYPES.Identifier) return undefined;
	if (!init) return undefined;
	if (!isWorldGetCall(init)) return undefined;

	const callee = init.callee as TSESTree.MemberExpression;
	const [entityNode, componentNode] = init.arguments;

	if (!entityNode || entityNode.type === AST_NODE_TYPES.SpreadElement) return undefined;
	if (!componentNode || componentNode.type === AST_NODE_TYPES.SpreadElement) return undefined;

	return {
		componentNode,
		entityNode,
		node: init,
		variableDeclaration: node,
		variableDeclarator: declarator,
		variableName: id.name,
		worldNode: callee.object,
	};
}

function getNodeText(node: TSESTree.Node, { sourceCode }: { readonly sourceCode: TSESLint.SourceCode }): string {
	return sourceCode.getText(node);
}

function filterGroups(group: GroupedCall): boolean {
	return group.calls.length >= 2;
}

function groupCallsByWorldAndEntity(
	calls: ReadonlyArray<WorldGetCall>,
	context: TSESLint.RuleContext<MessageIds, []>,
): ReadonlyArray<GroupedCall> {
	const groups = new Map<string, GroupedCall>();

	for (const call of calls) {
		const worldText = getNodeText(call.worldNode, context);
		const entityText = getNodeText(call.entityNode, context);
		const key = `${worldText}::${entityText}`;

		const existing = groups.get(key);
		if (existing) {
			const updatedCalls = [...existing.calls, call];
			groups.set(key, { ...existing, calls: updatedCalls });
		} else {
			groups.set(key, {
				calls: [call],
				entityText,
				worldText,
			});
		}
	}

	// oxlint-disable-next-line unicorn/no-array-callback-reference
	return [...groups.values()].filter(filterGroups);
}

function getVariableName(call: WorldGetCall): string {
	return call.variableName;
}

function generateFix(group: GroupedCall, context: TSESLint.RuleContext<MessageIds, []>): string {
	const { worldText, entityText, calls } = group;
	// oxlint-disable-next-line unicorn/no-array-callback-reference
	const variableNames = calls.map(getVariableName);
	const componentTexts = calls.map((call) => getNodeText(call.componentNode, context));

	const destructuring = variableNames.length === 1 ? variableNames[0] : `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");

	return `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;
}

export default createRule<[], MessageIds>({
	create(context) {
		const worldGetCalls = new Array<WorldGetCall>();
		let size = 0;

		return {
			"Program:exit"(): void {
				if (size < 2) return;

				const groups = groupCallsByWorldAndEntity(worldGetCalls, context);

				for (const group of groups) {
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

					const fixedCode = generateFix({ ...group, calls: sortedCalls }, context);

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
			},
			"VariableDeclaration[kind='const']"(node: TSESTree.VariableDeclaration): void {
				const call = extractWorldGetCall(node);
				if (call) worldGetCalls[size++] = call;
			},
		};
	},
	defaultOptions: [],
	meta: {
		docs: {
			description: "Enforce combining multiple world.get() calls into a single call for better Jecs performance.",
		},
		fixable: "code",
		messages: {
			preferSingleGet:
				"Multiple world.get() calls on the same entity should be combined into a single call for better performance.",
		},
		schema: [],
		type: "suggestion",
	},
	name: "prefer-single-get",
});
