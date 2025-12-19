import { objectToCamel } from "ts-case-convert";

const yeha = objectToCamel({
	key_one: "value one",
	key_two: {
		nested_key_four: [{ array_key_five: "value five" }, { array_key_six: "value six" }],
		nested_key_three: "value three",
	},
});

type CamelCase<TString extends string> = TString extends `${infer P1}_${infer P2}${infer P3}`
	? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
	: TString;

export type ToCamelCase<TObject> =
	TObject extends Array<infer ItemType>
		? Array<ToCamelCase<ItemType>>
		: TObject extends object
			? {
					[Key in keyof TObject as Key extends string
						? Key extends `_${string}`
							? never
							: CamelCase<Key>
						: Key]: ToCamelCase<TObject[Key]>;
				}
			: TObject;

type __ = ToCamelCase<typeof yeha>;
