// oxlint-disable typescript/no-empty-interface typescript/no-empty-object-type -- lol.
declare namespace JSX {
	// biome-ignore lint/suspicious/noEmptyInterface: lol.
	interface Element {}
	type IntrinsicElements = Record<string, unknown>;
}
