import type { Cases } from "./create-test-cases";

export const typeAliasCases: Cases = [
	{
		code: ["type % = {};", "type % = 1;"],
		options: {
			selector: "typeAlias",
		},
	},
];
