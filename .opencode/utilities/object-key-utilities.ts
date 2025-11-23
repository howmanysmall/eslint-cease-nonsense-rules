import * as pls from "ts-case-convert";

const yeha = pls.objectToCamel({
	key_one: "value one",
	key_two: {
		nested_key_four: [{ array_key_five: "value five" }, { array_key_six: "value six" }],
		nested_key_three: "value three",
	},
});

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
	? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
	: S;

export type ToCamelCase<T> =
	T extends Array<infer U>
		? Array<ToCamelCase<U>>
		: T extends object
			? {
					[K in keyof T as K extends string
						? K extends `_${string}` // omit keys that start with underscore (e.g. _links)
							? never
							: CamelCase<K>
						: K]: ToCamelCase<T[K]>;
				}
			: T;

type __ = ToCamelCase<typeof yeha>;
