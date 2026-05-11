import arrayTypeGeneric from "@rules/array-type-generic";
import banTypes from "@rules/ban-types";
import noArrayConstructorElements from "@rules/no-array-constructor-elements";
import noArraySizeAssignment from "@rules/no-array-size-assignment";
import noCommentedCode from "@rules/no-commented-code";
import preferExpectAssertions from "@rules/prefer-expect-assertions";
import preferPascalCaseEnums from "@rules/prefer-pascal-case-enums";
import preferSingularEnums from "@rules/prefer-singular-enums";
import preventAbbreviations from "@rules/prevent-abbreviations";
import requireSwitchCaseBraces from "@rules/require-switch-case-braces";
import requireUnicodeRegex from "@rules/require-unicode-regex";
import { definePlugin } from "oxlint-plugin-utilities";

const smallRules = definePlugin({
	meta: { name: "small-rules" },
	rules: {
		"array-type-generic": arrayTypeGeneric,
		"ban-types": banTypes,
		"no-array-constructor-elements": noArrayConstructorElements,
		"no-array-size-assignment": noArraySizeAssignment,
		"no-commented-code": noCommentedCode,
		"prefer-expect-assertions": preferExpectAssertions,
		"prefer-pascal-case-enums": preferPascalCaseEnums,
		"prefer-singular-enums": preferSingularEnums,
		"prevent-abbreviations": preventAbbreviations,
		"require-switch-case-braces": requireSwitchCaseBraces,
		"require-unicode-regex": requireUnicodeRegex,
	},
});

export default smallRules;
