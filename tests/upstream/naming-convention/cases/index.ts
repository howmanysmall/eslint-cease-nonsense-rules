import "./accessor.test";
import "./autoAccessor.test";
import "./class.test";
import "./classicAccessor.test";
import "./default.test";
import "./enum.test";
import "./enumMember.test";
import "./function.test";
import "./interface.test";
import "./method.test";
import "./parameter.test";
import "./parameterProperty.test";
import "./property.test";
import "./typeAlias.test";
import "./typeParameter.test";
import "./variable.test";

import { getNamingConventionCases } from "./createTestCases";

const { invalid, valid } = getNamingConventionCases();

export { invalid, valid };
