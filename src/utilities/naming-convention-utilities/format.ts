function isUppercaseCharacter(character: string): boolean {
	return character === character.toUpperCase() && character !== character.toLowerCase();
}

function isPascalCase(name: string): boolean {
	if (name.length === 0) return true;
	const [first] = name;
	return first === first?.toUpperCase() && !name.includes("_");
}

function isStrictPascalCase(name: string): boolean {
	if (name.length === 0) return true;
	const [first] = name;
	return first === first?.toUpperCase() && hasStrictCamelHumps(name, true);
}

function isCamelCase(name: string): boolean {
	if (name.length === 0) return true;
	const [first] = name;
	return first === first?.toLowerCase() && !name.includes("_");
}

function isStrictCamelCase(name: string): boolean {
	if (name.length === 0) return true;
	const [first] = name;
	return first === first?.toLowerCase() && hasStrictCamelHumps(name, false);
}

function hasStrictCamelHumps(name: string, isUpper: boolean): boolean {
	if (name.length === 0 || name.startsWith("_")) return false;

	let boolean = isUpper;
	for (let index = 1; index < name.length; index += 1) {
		const character = name[index];
		if (character === undefined || character === "_") return false;

		if (boolean === isUppercaseCharacter(character)) {
			if (boolean) return false;
		} else boolean = !boolean;
	}
	return true;
}

function isSnakeCase(name: string): boolean {
	return name.length === 0 || (name === name.toLowerCase() && validateUnderscores(name));
}

function isUpperCase(name: string): boolean {
	return name.length === 0 || (name === name.toUpperCase() && validateUnderscores(name));
}

function validateUnderscores(name: string): boolean {
	if (name.length === 0 || name.startsWith("_")) return false;

	let boolean = false;
	for (let index = 1; index < name.length; index += 1) {
		const character = name[index];
		if (character === undefined) return false;
		if (character === "_") {
			if (boolean) return false;
			boolean = true;
		} else boolean = false;
	}
	return !boolean;
}

export const PredefinedFormatToCheckFunction: Record<string, (name: string) => boolean> = {
	PascalCase: isPascalCase,
	StrictPascalCase: isStrictPascalCase,
	UPPER_CASE: isUpperCase,
	camelCase: isCamelCase,
	snake_case: isSnakeCase,
	strictCamelCase: isStrictCamelCase,
};
