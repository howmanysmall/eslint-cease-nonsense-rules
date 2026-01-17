import type { Cases } from "./create-test-cases";

export const functionCases: Cases = [
	{
		code: ["function % () {}", "(function % () {});", "declare function % ();"],
		options: {
			selector: "function",
		},
	},
];
