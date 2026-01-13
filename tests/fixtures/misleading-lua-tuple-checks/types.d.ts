// Type declarations for misleading-lua-tuple-checks tests
declare type LuaTuple<T extends unknown[]> = T & { readonly LUA_TUPLE: never };
declare interface IterableFunction<T> {
	(this: unknown): T;
}
