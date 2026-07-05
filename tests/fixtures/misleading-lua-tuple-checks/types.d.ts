// @ts-nocheck -- lol
// oxlint-disable typescript/method-signature-style -- lol
// Type declarations for misleading-lua-tuple-checks tests
declare interface String {
	gmatch(pattern: string): IterableFunction<LuaTuple<[string]>>;
}

export = [];
