import type { Cases } from "./create-test-cases";

export const classCases: Cases = [
	{
		code: ["class % {}", "abstract class % {}", "const ignored = class % {}"],
		options: {
			selector: "class",
		},
	},
];
