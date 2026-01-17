import type { Cases } from "./create-test-cases";

export const variableCases: Cases = [
	{
		code: [
			"const % = 1;",
			"let % = 1;",
			"var % = 1;",
			"const {%} = {ignored: 1};",
			"const {% = 2} = {ignored: 1};",
			"const {...%} = {ignored: 1};",
			"const [%] = [1];",
			"const [% = 1] = [1];",
			"const [...%] = [1];",
		],
		options: {
			selector: "variable",
		},
	},
];
