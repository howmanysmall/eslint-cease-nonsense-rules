import { TSESTree } from "@typescript-eslint/types";
import type { Rule } from "eslint";
import Typebox from "typebox";
import { Compile } from "typebox/compile";

const isNumericLiteralNode = Compile(
	Typebox.Object({
		type: Typebox.Literal(TSESTree.AST_NODE_TYPES.Literal),
		value: Typebox.Number(),
	}),
);

function mapComponentToRgbRange(value: number): number {
	return Math.round(value > 1 ? value : value * 255);
}

interface NumericComponentCollection {
	readonly components: ReadonlyArray<number>;
	readonly allZero: boolean;
}

function collectNumericComponents(parameters: ReadonlyArray<unknown>): NumericComponentCollection | undefined {
	const components = new Array<number>();
	let size = 0;
	let allZero = true;

	for (const parameter of parameters) {
		if (!isNumericLiteralNode.Check(parameter)) return undefined;

		const mapped = mapComponentToRgbRange(parameter.value);
		components[size++] = mapped;
		if (mapped !== 0) allZero = false;
	}

	return { allZero, components };
}

const noColor3Constructor: Rule.RuleModule = {
	create(context) {
		return {
			NewExpression(node) {
				if (node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier || node.callee.name !== "Color3") return;

				const parameters = node.arguments;
				if (parameters.length === 0) return;

				const collected = collectNumericComponents(parameters);
				if (!collected) {
					context.report({
						messageId: parameters.length < 3 ? "useFromRGB" : "onlyZeroArgs",
						node,
					});
					return;
				}

				if (parameters.length < 3) {
					const [red, green = 0] = collected.components;
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${red}, ${green}, 0)`),
						messageId: "useFromRGB",
						node,
					});
					return;
				}

				if (!collected.allZero) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${collected.components.join(", ")})`),
						messageId: "onlyZeroArgs",
						node,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Ban new Color3(...) except new Color3() or new Color3(0, 0, 0). Use Color3.fromRGB() instead.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			onlyZeroArgs:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255]. Only 'new Color3()' or 'new Color3(0, 0, 0)' are allowed.",
			useFromRGB:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255].",
		},
		schema: [],
		type: "problem",
	},
};

export default noColor3Constructor;
