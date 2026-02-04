import type { Cases } from "./create-test-cases";

export const parameterPropertyCases: Cases = [
	{
		code: [
			"class Ignored { constructor(private %) {} }",
			"class Ignored { constructor(readonly %) {} }",
			"class Ignored { constructor(private readonly %) {} }",
		],
		options: {
			selector: "parameterProperty",
		},
	},
	{
		code: ["class Ignored { constructor(private readonly %) {} }"],
		options: {
			modifiers: ["readonly"],
			selector: "parameterProperty",
		},
	},
];
