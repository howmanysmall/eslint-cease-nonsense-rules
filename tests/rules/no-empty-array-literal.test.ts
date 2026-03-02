import { describe } from "bun:test";
import { dirname } from "node:path";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "bun";

import rule from "../../src/rules/no-empty-array-literal";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

const typeAwareRuleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
			projectService: {
				allowDefaultProject: ["*.ts", "*.tsx"],
				maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 64,
			},
			tsconfigRootDir: __dirname,
		},
		sourceType: "module",
	},
});

describe("no-empty-array-literal", () => {
	ruleTester.run("no-empty-array-literal", rule, {
		invalid: [
			{
				code: "const x: number[] = [];",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "const x: number[] = new Array();",
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: "function f(x: number[] = []) { return x; }",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "function f(x: number[] = new Array()) { return x; }",
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: "interface Foo { id: string }\nclass C { xs: ReadonlyArray<Foo> = []; }",
				errors: [{ messageId: "noEmptyArrayLiteral" }],
				output: "interface Foo { id: string }\nclass C { xs: ReadonlyArray<Foo> = new Array<Foo>(); }",
			},
			{
				code: "const x = [];",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "const x = new Array();",
							},
						],
					},
				],
				output: undefined,
			},
			{
				code: "useMemo(() => true, []);",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "useMemo(() => true, new Array());",
							},
						],
					},
				],
				options: [{ allowedEmptyArrayContexts: { callArguments: false } }],
				output: undefined,
			},
			{
				code: "for (const value of []) { void value; }",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "for (const value of new Array()) { void value; }",
							},
						],
					},
				],
				options: [{ allowedEmptyArrayContexts: { forOfStatements: false } }],
				output: undefined,
			},
			{
				code: "type ComponentList = ReadonlyArray<string>; const values = [] as ComponentList;",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "type ComponentList = ReadonlyArray<string>; const values = new Array() as ComponentList;",
							},
						],
					},
				],
				options: [{ allowedEmptyArrayContexts: { typeAssertions: false } }],
				output: undefined,
			},
			{
				code: "const rewards = true ? ['story'] : [];",
				errors: [
					{
						messageId: "noEmptyArrayLiteral",
						suggestions: [
							{
								messageId: "suggestUseNewArray",
								output: "const rewards = true ? ['story'] : new Array();",
							},
						],
					},
				],
				options: [{ allowedEmptyArrayContexts: { conditionalExpressions: false } }],
				output: undefined,
			},
		],
		valid: [
			"const xs = [1, 2, 3];",
			"const pairs = [[1, 'one'], [2, 'two']];",
			{
				code: "const xs = [1, 2, 3];",
				options: [{ ignoreInferredNonEmptyLiterals: false }],
			},
			{
				code: "useMemo(() => true, []);",
				options: [
					{
						allowedEmptyArrayContexts: {
							callArguments: true,
						},
					},
				],
			},
			"const empty = new Array<string>();",
			"type MobData = { mobTypes: Array<string> };\nconst mob = { mobTypes: [] } satisfies MobData;",
			`
declare const gameMode: "story" | "default";
declare const cache: { rewards?: readonly string[] };
const rewards = gameMode === "story" ? cache.rewards ?? [] : [];
			`,
			"const defaultValues: ReadonlyArray<number> = [];",
			"type UnitCostRefundArray = Array<number>;\nconst unitsOfCostId: UnitCostRefundArray = [];",
			"type ComponentList = ReadonlyArray<string>; const values = [] as ComponentList;",
			`
type BreakpointValue = number;
type BreakpointList<T> = ReadonlyArray<T>;

class BreakpointTemplate<T extends Record<string, number>> {
	public map<K extends { [P in keyof T]: BreakpointValue }>(
		values: K,
		deviations: BreakpointList<K[keyof K]> = [],
	): BreakpointList<K[keyof K]> {
		void values;
		void deviations;
		return [] as BreakpointList<K[keyof K]>;
	}
}
			`,
			`
declare function useMemo<TValue>(factory: () => TValue, dependencies: ReadonlyArray<unknown>): TValue;
const value = useMemo(() => true, []);
			`,
			`
declare function useEventConnection(
	event: unknown,
	handler: (deltaTime: number) => void,
	dependencies: ReadonlyArray<unknown>,
): void;
useEventConnection({}, (_deltaTime: number) => {}, []);
			`,
			`
type QuestId = string;
declare function useState<TState>(initialState: TState): [TState, (next: TState) => void];
const [categoryIds, setCategoryIds] = useState<ReadonlyArray<QuestId>>([]);
			`,
			`
declare function useRef<TValue>(initialValue: TValue): { current: TValue };
const damageHistoryReference = useRef<Array<{ readonly damage: number; readonly time: number }>>([]);
			`,
			`
type EffectLike = () => void;

export default function useThreadEffect(callback: EffectLike, dependencies: ReadonlyArray<unknown> = []): void {
	void callback;
	void dependencies;
	return;
}
			`,
			`
type MouseTipEntry = { readonly id: string };
type MouseTipList = ReadonlyArray<MouseTipEntry>;
const defaultMouseTips: MouseTipList = [];
			`,
			`
const craftingCostItem: { usages: { craftsInto?: Array<string> } } = { usages: {} };
craftingCostItem.usages.craftsInto ??= [];
			`,
			`
const groups = new Map<string, Array<number>>();
let values = groups.get("key");
if (!values) {
	values = [];
	groups.set("key", values);
}
			`,
			`
const values: { items?: Array<number> } = {};
for (const item of values.items ?? []) {
	void item;
}
			`,
			`
const base: { synergies?: Array<string> } = {};
for (const synergyId of base.synergies ?? []) {
	void synergyId;
}
			`,
			`
const key = "crates";
const obtainment: Partial<Record<string, Array<string>>> = {};
obtainment[key] ??= [];
			`,
			`
enum Category {
	StoryMode = "StoryMode",
}
const cache: { groups?: Partial<Record<Category, Array<string>>> } = {};
cache.groups ??= {};
cache.groups[Category.StoryMode] ??= [];
			`,
			`
const spatial: { rebuild(values: Array<number>): void } = {
	rebuild(_values: Array<number>): void {},
};
spatial.rebuild([]);
			`,
			`
enum MapId {
	PlanetNamak = "PlanetNamak",
}
declare const center: { [key: string]: unknown };
declare const MAP_STYLE_META: Record<MapId, unknown>;

declare function MatchInfoPlate(props: {
	playerIds: unknown;
	mapStyle: unknown;
	shadowTransparency: number;
	nativeProperties: unknown;
}): JSX.Element;

const result = (
	<MatchInfoPlate
		key="match-info-plate"
		mapStyle={MAP_STYLE_META[MapId.PlanetNamak]}
		nativeProperties={{
			AnchorPoint: center,
			Position: { foo: 1 },
			Size: { bar: 2 },
		}}
		playerIds={[]}
		shadowTransparency={0.5}
	/>
);
void result;
`,
			`
declare function useEventListener(
	event: unknown,
	handler: () => void,
): void;
declare const UserInputService: { InputEnded: unknown };
declare function setIsDragging(value: boolean): void;
declare function setPattern(value: Array<number>): void;
useEventListener(UserInputService.InputEnded, () => {
	setIsDragging(false);
	setPattern([]);
});
			`,
			`
declare function consume(values: Array<number>): void;
consume([]);
			`,
			`
class Container {
	constructor(_values: Array<number>) {}
}
const container = new Container([]);
			`,
			`
function buildResult(shouldBeEmpty: boolean): Array<number> {
	if (shouldBeEmpty) return [];
	return [1];
}
			`,
		],
	});
});

describe("no-empty-array-literal (type-aware inference)", () => {
	typeAwareRuleTester.run("no-empty-array-literal-type-aware", rule, {
		invalid: [],
		valid: [
			{
				code: "function create(): Array<number> { return [1, 2, 3]; }",
				options: [{ inferTypeForEmptyArrayFix: true }],
			},
			{
				code: "declare function consume(values: Array<number>): void;\nconsume([]);",
				options: [{ inferTypeForEmptyArrayFix: true }],
			},
			{
				code: "let values: Array<number>;\nvalues = [];",
				options: [{ inferTypeForEmptyArrayFix: true }],
			},
			{
				code: `
function useValues<T>(): void {
	type ComponentList<U> = ReadonlyArray<U>;
	const values = [] as ComponentList<T>;
	void values;
}
					`,
				options: [{ inferTypeForEmptyArrayFix: true }],
			},
		],
	});
});
