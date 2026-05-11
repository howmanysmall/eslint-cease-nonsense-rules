import type { Cases } from "./create-test-cases";

export const enumMemberCases: Cases = [
	{
		code: ["enum Ignored { % }", 'enum Ignored { "%" }'],
		options: {
			selector: "enumMember",
		},
	},
];
