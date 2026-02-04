import { shardCases } from "../../../utilities/shard-cases";
import { accessorCases } from "./accessor.test";
import { autoAccessorCases } from "./auto-accessor.test";
import { classCases } from "./class.test";
import { classicAccessorCases } from "./classic-accessor.test";
import type { NamingConventionCases } from "./create-test-cases";
import { processTestCases } from "./create-test-cases";
import { defaultCases } from "./default.test";
import { enumCases } from "./enum.test";
import { enumMemberCases } from "./enum-member.test";
import { functionCases } from "./function.test";
import { interfaceCases } from "./interface.test";
import { methodCases } from "./method.test";
import { parameterCases } from "./parameter.test";
import { parameterPropertyCases } from "./parameter-property.test";
import { propertyCases } from "./property.test";
import { typeAliasCases } from "./type-alias.test";
import { typeParameterCases } from "./type-parameter.test";
import { variableCases } from "./variable.test";

const allCases = [
	...accessorCases,
	...autoAccessorCases,
	...classCases,
	...classicAccessorCases,
	...defaultCases,
	...enumCases,
	...enumMemberCases,
	...functionCases,
	...interfaceCases,
	...methodCases,
	...parameterCases,
	...parameterPropertyCases,
	...propertyCases,
	...typeAliasCases,
	...typeParameterCases,
	...variableCases,
];

const processed: NamingConventionCases = processTestCases(allCases);

export const invalid = shardCases(processed.invalid);
export const valid = shardCases(processed.valid);
