import { shardCases } from "../../../utilities/shard-cases";
import { accessorCases } from "./accessor.case";
import { autoAccessorCases } from "./auto-accessor.case";
import { classCases } from "./class.case";
import { classicAccessorCases } from "./classic-accessor.case";
import { processTestCases } from "./create-test-cases";
import { defaultCases } from "./default.case";
import { enumMemberCases } from "./enum-member.case";
import { enumCases } from "./enum.case";
import { functionCases } from "./function.case";
import { interfaceCases } from "./interface.case";
import { methodCases } from "./method.case";
import { parameterPropertyCases } from "./parameter-property.case";
import { parameterCases } from "./parameter.case";
import { propertyCases } from "./property.case";
import { typeAliasCases } from "./type-alias.case";
import { typeParameterCases } from "./type-parameter.case";
import { variableCases } from "./variable.case";

import type { NamingConventionCases } from "./create-test-cases";

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
