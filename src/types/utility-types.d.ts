/**
 * A `ReadonlyRecord` is a `Record` where all properties are `readonly`.
 */
export type ReadonlyRecord<Key extends number | string | symbol, Value> = Readonly<Record<Key, Value>>;
