/**
 * Type definitions for testing misleading-lua-tuple-checks rule.
 * LuaTuple is a Roblox-TS type that represents Lua's multiple return values.
 */

/** @deprecated nobody gaf */
export declare const __unused: unique symbol;

/**
 * LuaTuple marker type - arrays with this alias are detected by the rule.
 */
declare global {
	type LuaTuple<TupleType extends Array<unknown>> = TupleType & { readonly __LuaTuple?: never };

	/**
	 * Example function that returns a LuaTuple (like Lua's pcall)
	 */
	function pcall<TupleType extends Array<unknown>>(callback: () => TupleType): LuaTuple<[boolean, ...TupleType]>;

	/**
	 * Example function that returns a LuaTuple with error
	 */
	function xpcall<TupleType extends Array<unknown>>(
		callback: () => TupleType,
		errorHandler: (err: unknown) => void,
	): LuaTuple<[boolean, ...TupleType]>;

	/**
	 * Example Roblox function that returns LuaTuple
	 */
	function FindFirstChildOfClass(className: string): LuaTuple<[Instance | undefined, boolean]>;

	/**
	 * Simple LuaTuple-returning function for tests
	 */
	function getLuaTuple(): LuaTuple<[string, number]>;

	/**
	 * Function that returns LuaTuple with potentially undefined first element
	 */
	function getMaybeLuaTuple(): LuaTuple<[string | undefined, number]>;

	/**
	 * Function that returns a regular array (not LuaTuple)
	 */
	function getRegularArray(): [string, number];

	/**
	 * Iterator that yields LuaTuples
	 */
	function pairs<ValueType>(table: Map<string, ValueType>): IterableIterator<LuaTuple<[string, ValueType]>>;

	/**
	 * Dummy Instance type for Roblox
	 */
	class Instance {
		Name: string;
	}
}
