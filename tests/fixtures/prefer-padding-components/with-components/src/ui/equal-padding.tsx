export interface EqualPaddingProperties {
	readonly padding?: unknown;
}

export function EqualPadding({ padding }: EqualPaddingProperties): unknown {
	return padding;
}

export default EqualPadding;
