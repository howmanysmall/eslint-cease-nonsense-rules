import { describe } from "bun:test";
import { RuleTester } from "eslint";
import rule from "../../src/rules/use-exhaustive-dependencies";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		sourceType: "module",
	},
});

describe("use-exhaustive-dependencies", () => {
	ruleTester.run("use-exhaustive-dependencies", rule, {
		invalid: [
			// Missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Missing multiple dependencies
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("");
    useEffect(() => {
        console.log(count, name);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependencies",
						suggestions: [
							{
								desc: "Add missing dependencies to array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("");
    useEffect(() => {
        console.log(count, name);
    }, [count, name]);
}
`,
							},
						],
					},
				],
			},

			// Missing dependencies array
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    });
}
`,
				errors: [
					{
						messageId: "missingDependenciesArray",
						suggestions: [
							{
								desc: "Add dependencies array: [count]",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Unnecessary dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, [count]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'count' from dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, []);
}
`,
							},
						],
					},
				],
			},

			// Unstable dependency - inline function
			{
				code: `
function Component() {
    const handler = () => {};
    useEffect(() => {
        handler();
    }, [handler]);
}
`,
				errors: [{ messageId: "unstableDependency" }],
			},

			// Unstable dependency - inline object
			{
				code: `
function Component() {
    const config = {};
    useEffect(() => {
        console.log(config);
    }, [config]);
}
`,
				errors: [{ messageId: "unstableDependency" }],
			},

			// Missing dependency in useCallback
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const callback = useCallback(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const callback = useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Missing dependency in useMemo
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const value = useMemo(() => {
        return count * 2;
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const value = useMemo(() => {
        return count * 2;
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Missing dependency in useLayoutEffect
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Missing dependency with member expression
			{
				code: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj.prop' to dependencies array",
								output: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, [obj.prop]);
}
`,
							},
						],
					},
				],
			},

			// Member expression - dependency too specific
			{
				code: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, [obj.nested.value]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'obj.nested.value' from dependencies array",
								output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, []);
}
`,
							},
						],
					},
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj.nested' to dependencies array",
								output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, [obj.nested, obj.nested.value]);
}
`,
							},
						],
					},
				],
			},

			// Missing dependency in useImperativeHandle (closure at index 1)
			{
				code: `
function Component(ref) {
    const [value, setValue] = useState(0);
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'value' to dependencies array",
								output: `
function Component(ref) {
    const [value, setValue] = useState(0);
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), [value]);
}
`,
							},
						],
					},
				],
			},

			// React Lua - useBinding with missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const [binding, setBinding] = useBinding(() => count);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const [binding, setBinding] = useBinding(() => count);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Multiple hooks with missing dependencies
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
    useCallback(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
    useCallback(() => {
        console.log(count);
    }, []);
}
`,
							},
						],
					},
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
    useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
			},

			// Prop dependency missing
			{
				code: `
function Component(props) {
    useEffect(() => {
        console.log(props.value);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'props.value' to dependencies array",
								output: `
function Component(props) {
    useEffect(() => {
        console.log(props.value);
    }, [props.value]);
}
`,
							},
						],
					},
				],
			},

			// Optional chaining - missing dependency
			{
				code: `
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj?.prop' to dependencies array",
								output: `
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj?.prop]);
}
`,
							},
						],
					},
				],
			},

			// Optional chaining - chained access missing
			{
				code: `
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj?.nested?.value' to dependencies array",
								output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, [obj?.nested?.value]);
}
`,
							},
						],
					},
				],
			},
		],
		valid: [
			// Correct dependencies
			`
function Component() {
    const a = 1;
    useEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// Multiple correct dependencies
			`
function Component() {
    const a = 1;
    const b = 2;
    useEffect(() => {
        console.log(a, b);
    }, [a, b]);
}
`,

			// No dependencies needed - no captures
			`
function Component() {
    useEffect(() => {
        console.log("hello");
    }, []);
}
`,

			// useState setter is stable
			`
function Component() {
    const [state, setState] = useState(0);
    useEffect(() => {
        setState(1);
    }, []);
}
`,

			// useState with state in deps
			`
function Component() {
    const [state, setState] = useState(0);
    useEffect(() => {
        console.log(state);
        setState(1);
    }, [state]);
}
`,

			// useReducer dispatch is stable
			`
function Component() {
    const [state, dispatch] = useReducer(reducer, initial);
    useEffect(() => {
        dispatch({ type: "INCREMENT" });
    }, []);
}
`,

			// useRef is stable
			`
function Component() {
    const ref = useRef(null);
    useEffect(() => {
        console.log(ref.current);
    }, []);
}
`,

			// React Lua - useBinding is fully stable
			`
function Component() {
    const [binding, setBinding] = useBinding(0);
    useEffect(() => {
        setBinding(1);
        console.log(binding);
    }, []);
}
`,

			// Imported values don't need dependencies
			`
import { helper } from "./utils";
function Component() {
    useEffect(() => {
        helper();
    }, []);
}
`,

			// Constants are stable
			`
const CONSTANT = 10;
function Component() {
    useEffect(() => {
        console.log(CONSTANT);
    }, []);
}
`,

			// Member expression with correct dependency
			`
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, [obj]);
}
`,

			// Member expression - exact match
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested.value);
    }, [obj.nested.value]);
}
`,

			// useCallback with correct dependencies
			`
function Component() {
    const a = 1;
    const callback = useCallback(() => {
        console.log(a);
    }, [a]);
}
`,

			// useMemo with correct dependencies
			`
function Component() {
    const a = 1;
    const value = useMemo(() => {
        return a * 2;
    }, [a]);
}
`,

			// useLayoutEffect with correct dependencies
			`
function Component() {
    const a = 1;
    useLayoutEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// useImperativeHandle with correct dependencies
			`
function Component(ref) {
    const value = 1;
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), [value]);
}
`,

			// Destructured props
			`
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [value]);
}
`,

			// Function parameter
			`
function Component(callback) {
    useEffect(() => {
        callback();
    }, [callback]);
}
`,

			// No dependencies array with no captures
			`
function Component() {
    useEffect(() => {
        console.log("hello");
    });
}
`,

			// Conditional logic inside hook
			`
function Component() {
    const a = 1;
    useEffect(() => {
        if (condition) {
            console.log(a);
        }
    }, [a]);
}
`,

			// React namespace hook
			`
function Component() {
    const a = 1;
    React.useEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// All standard hooks with correct deps
			`
function Component() {
    const a = 1;
    useEffect(() => { console.log(a); }, [a]);
    useLayoutEffect(() => { console.log(a); }, [a]);
    useCallback(() => { console.log(a); }, [a]);
    useMemo(() => a, [a]);
}
`,

			// useTransition startTransition is stable
			`
function Component() {
    const [isPending, startTransition] = useTransition();
    useEffect(() => {
        startTransition(() => {
            // transition
        });
    }, []);
}
`,

			// Props with stable setter
			`
function Component(props) {
    const [state, setState] = useState(0);
    useEffect(() => {
        setState(props.value);
    }, [props.value]);
}
`,

			// Computed property access
			`
function Component() {
    const obj = { prop: 1 };
    const key = "prop";
    useEffect(() => {
        console.log(obj[key]);
    }, [obj, key]);
}
`,

			// React Lua - multiple useBinding calls
			`
function Component() {
    const [binding1] = useBinding(0);
    const [binding2] = useBinding(0);
    useEffect(() => {
        console.log(binding1, binding2);
    }, []);
}
`,

			// Global built-ins should not be reported as dependencies
			`
function Component() {
    useEffect(() => {
        const arr = new Array();
    }, []);
}
`,

			// TypeScript type parameters should not be dependencies (simplified without generic syntax)
			`
function Component() {
    const setMemorySafeState = useCallback((newState) => {
        // Type annotations like SetStateAction<S> would be here in real code
        setState(newState);
    }, []);
}
`,

			// React.joinBindings returns a stable binding
			`
function Component() {
    const joined = React.joinBindings({ a, b });
    useEffect(() => {
        console.log(joined);
    }, []);
}
`,

			// Binding.map() returns a stable binding
			`
function Component() {
    const binding = useBinding(0);
    const mapped = binding.map(x => x * 2);
    useEffect(() => {
        console.log(mapped);
    }, []);
}
`,

			// React.joinBindings().map() chained call is stable
			`
function Component() {
    const scaleBinding = React.joinBindings({ a, b }).map(({ a, b }) => a + b);
    useMemo(() => {
        return scaleBinding.map(scale => scale * 2);
    }, []);
}
`,

			// Module-level constants should not be dependencies
			`
const log = { Warning: () => {}, Info: () => {} };
function Component() {
    useEffect(() => {
        log.Warning("test");
        log.Info("info");
    }, []);
}
`,

			// Outer function scope should not be dependencies
			`
function useOuter() {
    const helper = () => {};

    function useInner() {
        useEffect(() => {
            helper();
        }, []);
    }
}
`,

			// Component-scope literal constant is stable
			`
function Component() {
    const x = 1;
    const y = "string";
    const z = null;
    useEffect(() => {
        console.log(x, y, z);
    }, []);
}
`,
			`
function Component() {
    const value = 10;
    useMemo(() => {
        if (value === undefined) return null;
        return value;
    }, [value]);
}
`,
			`
function Component() {
    useCallback(() => {
        return Promise.resolve();
    }, []);
}
`,
			`
function Component() {
    useEffect(() => {
        console.log(Math.PI);
    }, []);
}
`,
			`
function Component() {
    useMemo(() => {
        const arr = new Array();
        return arr;
    }, []);
}
`,
			`
function Component() {
    useEffect(() => {
        const map = new Map();
        const set = new Set();
        const date = new Date();
    }, []);
}
`,
			// Local loop variable in useMemo with shadowing
			`
function Component() {
    const i = 10;
    const items = [1, 2, 3];
    useMemo(() => {
        for (let i = 0; i < items.length; i++) {
            console.log(i);
        }
    }, [items]);
}
`,
			// Shadowing variable in nested block
			`
function Component() {
    const local = 10;
    useMemo(() => {
        {
            let local = 0;
            console.log(local);
        }
    }, []);
}
`,

			// Optional chaining - basic
			`
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj?.prop]);
}
`,

			// Optional chaining - chained access
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, [obj?.nested?.value]);
}
`,

			// Optional chaining - mixed (optional then regular)
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested.value, [obj?.nested.value]);
}
`,

			// Optional chaining - mixed (regular then optional)
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj.nested?.value, [obj.nested?.value]);
}
`,

			// Optional chaining - parent dependency covers optional access
			`
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj]);
}
`,

			// Optional chaining with method call
			`
function Component() {
    const obj = { method: () => 1 };
    useMemo(() => obj?.method(), [obj]);
}
`,
		],
	});

	ruleTester.run("use-exhaustive-dependencies", rule, {
		invalid: [
			// Custom hook with missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useCustomHook(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useCustomHook(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				options: [
					{
						hooks: [
							{
								closureIndex: 0,
								dependenciesIndex: 1,
								name: "useCustomHook",
							},
						],
					},
				],
			},
		],
		valid: [
			// Disable reportUnnecessaryDependencies
			{
				code: `
function Component() {
    const b = 1;
    useEffect(() => {}, [b]);
}
`,
				options: [
					{
						reportUnnecessaryDependencies: false,
					},
				],
			},

			// Disable reportMissingDependenciesArray
			{
				code: `
function Component() {
    const a = 1;
    useEffect(() => {
        console.log(a);
    });
}
`,
				options: [
					{
						reportMissingDependenciesArray: false,
					},
				],
			},

			// Custom hook with correct dependencies
			{
				code: `
function Component() {
    const a = 1;
    useCustomHook(() => {
        console.log(a);
    }, [a]);
}
`,
				options: [
					{
						hooks: [
							{
								closureIndex: 0,
								dependenciesIndex: 1,
								name: "useCustomHook",
							},
						],
					},
				],
			},

			// Custom hook with stable result
			{
				code: `
function Component() {
    const setter = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: true,
							},
						],
					},
				],
			},

			// Custom hook with stable array index
			{
				code: `
function Component() {
    const [state, setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: [1],
							},
						],
					},
				],
			},
		],
	});
});
