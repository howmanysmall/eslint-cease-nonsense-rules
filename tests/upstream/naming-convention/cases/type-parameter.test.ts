import type { Cases } from "./create-test-cases";

export const typeParameterCases: Cases = [
	{
		code: [
			"class Ignored<%> {}",
			"function ignored<%>() {}",
			"type Ignored<%> = { ignored: % };",
			"interface Ignored<%> extends Ignored<string> {}",
		],
		options: {
			selector: "typeParameter",
		},
	},
];
