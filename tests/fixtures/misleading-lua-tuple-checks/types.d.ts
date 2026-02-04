// Type declarations for misleading-lua-tuple-checks tests
declare interface String {
	gmatch(pattern: string): IterableFunction<LuaTuple<[string]>>;
}
