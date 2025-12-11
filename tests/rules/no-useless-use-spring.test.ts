import { describe } from "bun:test";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../../src/rules/no-useless-use-spring";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser: tsParser,
		sourceType: "module",
	},
});

describe("no-useless-use-spring", () => {
	ruleTester.run("no-useless-use-spring", rule, {
		invalid: [
			{
				code: `
import { config } from "./config";
import { UDim2 } from "./roblox";

const topDecorPositionSpring = useSpring(
  {
    config: config.default,
    position: UDim2.fromScale(0.31, 0.11),
  },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const opacitySpring = useSpring(
  { opacity: 1 },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const opacitySpring = useSpring({ opacity: 1 });
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const ALWAYS = 1;

function Component() {
  const spring = useSpring({ opacity: 1 }, [ALWAYS]);
  return spring;
}
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const CONFIG = { opacity: 1 } as const;

function Component() {
  const spring = useSpring(CONFIG, []);
  return spring;
}
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = useMotion({ opacity: 1 }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
				options: [
					{
						springHooks: ["useMotion"],
					},
				],
			},
			{
				code: `
const spring = useSpring({ opacity: (1 as const) }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import { StaticCtor } from "./ctors";
const STATIC_OBJ = { value: 1 } as const;

const spring = useSpring(
  {
    unary: -1,
    binary: 1 + 2,
    logical: true && false,
    conditional: true ? 1 : 2,
    template: \`static\`,
    array: [1, 2, \`x\`],
    memberComputed: STATIC_OBJ?.["value"],
    call: StaticCtor.create(1),
    instance: new StaticCtor(0),
    sequence: (1, 2),
  },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import * as Numbers from "./numbers";

const spring = useSpring({ value: Numbers["ONE"] }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
		],
		valid: [
			`
import { config } from "./config";
import { UDim2 } from "./roblox";

function Component({ x, y }) {
  const spring = useSpring(
    {
      config: config.default,
      position: UDim2.fromScale(x, y),
    },
    [x, y],
  );
  return spring;
}
`,
			`
function Component() {
  const [isOpen] = useState(false);
  const opacitySpring = useSpring({ opacity: isOpen ? 1 : 0 }, [isOpen]);
  return opacitySpring;
}
`,
			`
import { UDim2 } from "./roblox";

function Component({ x }) {
  const spring = useSpring({ position: UDim2.fromScale(0.3, 0.1) }, [x]);
  return spring;
}
`,
			`
function Component() {
  const options = getSpringOptions();
  const spring = useSpring({ opacity: 1 }, options);
  return spring;
}
`,
			{
				code: `
const opacitySpring = useSpring(
  { opacity: 1 },
  [],
);
`,
				options: [
					{
						treatEmptyDepsAsViolation: false,
					},
				],
			},
			`
const spring = useMotion({ opacity: 1 }, []);
`,
			`
const spring = useSpring({ opacity: MISSING }, []);
`,
			`
import configObj from "./configObj";

const spring = useSpring(configObj, []);
`,
			`
function Component(deps) {
  const spring = useSpring({ opacity: 1 }, [...deps]);
  return spring;
}
`,
			`
const NON_STATIC = () => {};
const spring = useSpring({ fn: NON_STATIC }, []);
`,
			`
const spring = useSpring({ created: new Date() }, []);
`,
		],
	});
});
