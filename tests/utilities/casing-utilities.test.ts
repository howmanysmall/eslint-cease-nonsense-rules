import { describe, expect, it } from "vitest";
import {
	applyCasing as apply,
	Casing,
	copy,
	detect,
	isCamelCase,
	isConstantCase,
	isDotCase,
	isKebabCase,
	isLowerCase,
	isPascalCase,
	isPathCase,
	isSnakeCase,
	isTitleCase,
	isUnknown,
	isUpperCase,
	setLocaleMode,
	toCamelCase,
	toConstantCase,
	toDotCase,
	toKebabCase,
	toLowerCase,
	toPascalCase,
	toPathCase,
	toSnakeCase,
	toSpaceCase,
	toTitleCase,
	toUpperCase,
} from "$utilities/casing-utilities";

describe("casing-utilities", () => {
	describe("isConstantCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isConstantCase("camelCase")).toBe(false);
			expect(isConstantCase("CONSTANT_CASE")).toBe(true);
			expect(isConstantCase("dot.case")).toBe(false);
			expect(isConstantCase("SCREAMING-KEBAB")).toBe(false);
			expect(isConstantCase("kebab-case")).toBe(false);
			expect(isConstantCase("lowercase")).toBe(false);
			expect(isConstantCase("PascalCase")).toBe(false);
			expect(isConstantCase("path/case")).toBe(false);
			expect(isConstantCase("snake_case")).toBe(false);
			expect(isConstantCase("Title Case")).toBe(false);
			expect(isConstantCase("UPPERCASE")).toBe(true);
			expect(isConstantCase("useHTMLBox")).toBe(false);
			expect(isConstantCase("HTMLParser")).toBe(false);
			expect(isConstantCase("sYlLyCaSe")).toBe(false);
			expect(isConstantCase("SyLlYcAsE")).toBe(false);
			expect(isConstantCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isConstantCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isDotCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isDotCase("camelCase")).toBe(false);
			expect(isDotCase("CONSTANT_CASE")).toBe(false);
			expect(isDotCase("dot.case")).toBe(true);
			expect(isDotCase("SCREAMING-KEBAB")).toBe(false);
			expect(isDotCase("kebab-case")).toBe(false);
			expect(isDotCase("lowercase")).toBe(true);
			expect(isDotCase("PascalCase")).toBe(false);
			expect(isDotCase("path/case")).toBe(false);
			expect(isDotCase("snake_case")).toBe(false);
			expect(isDotCase("Title Case")).toBe(false);
			expect(isDotCase("UPPERCASE")).toBe(false);
			expect(isDotCase("useHTMLBox")).toBe(false);
			expect(isDotCase("HTMLParser")).toBe(false);
			expect(isDotCase("sYlLyCaSe")).toBe(false);
			expect(isDotCase("SyLlYcAsE")).toBe(false);
			expect(isDotCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isDotCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isKebabCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isKebabCase("camelCase")).toBe(false);
			expect(isKebabCase("CONSTANT_CASE")).toBe(false);
			expect(isKebabCase("dot.case")).toBe(false);
			expect(isKebabCase("SCREAMING-KEBAB")).toBe(false);
			expect(isKebabCase("kebab-case")).toBe(true);
			expect(isKebabCase("lowercase")).toBe(true);
			expect(isKebabCase("PascalCase")).toBe(false);
			expect(isKebabCase("path/case")).toBe(false);
			expect(isKebabCase("snake_case")).toBe(false);
			expect(isKebabCase("Title Case")).toBe(false);
			expect(isKebabCase("UPPERCASE")).toBe(false);
			expect(isKebabCase("useHTMLBox")).toBe(false);
			expect(isKebabCase("HTMLParser")).toBe(false);
			expect(isKebabCase("sYlLyCaSe")).toBe(false);
			expect(isKebabCase("SyLlYcAsE")).toBe(false);
			expect(isKebabCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isKebabCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isLowerCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isLowerCase("camelCase")).toBe(false);
			expect(isLowerCase("CONSTANT_CASE")).toBe(false);
			expect(isLowerCase("dot.case")).toBe(false);
			expect(isLowerCase("SCREAMING-KEBAB")).toBe(false);
			expect(isLowerCase("kebab-case")).toBe(false);
			expect(isLowerCase("lowercase")).toBe(true);
			expect(isLowerCase("PascalCase")).toBe(false);
			expect(isLowerCase("path/case")).toBe(false);
			expect(isLowerCase("snake_case")).toBe(false);
			expect(isLowerCase("Title Case")).toBe(false);
			expect(isLowerCase("UPPERCASE")).toBe(false);
			expect(isLowerCase("useHTMLBox")).toBe(false);
			expect(isLowerCase("HTMLParser")).toBe(false);
			expect(isLowerCase("sYlLyCaSe")).toBe(false);
			expect(isLowerCase("SyLlYcAsE")).toBe(false);
			expect(isLowerCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isLowerCase("  multi UPPER word  ")).toBe(false);
		});

		it("rejects non-ASCII uppercase characters that lowercase to multiple code points", () => {
			expect.assertions(1);
			expect(isLowerCase("İ")).toBe(false);
		});
	});

	describe("isPascalCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isPascalCase("camelCase")).toBe(false);
			expect(isPascalCase("CONSTANT_CASE")).toBe(false);
			expect(isPascalCase("dot.case")).toBe(false);
			expect(isPascalCase("SCREAMING-KEBAB")).toBe(false);
			expect(isPascalCase("kebab-case")).toBe(false);
			expect(isPascalCase("lowercase")).toBe(false);
			expect(isPascalCase("PascalCase")).toBe(true);
			expect(isPascalCase("path/case")).toBe(false);
			expect(isPascalCase("snake_case")).toBe(false);
			expect(isPascalCase("Title Case")).toBe(false);
			expect(isPascalCase("UPPERCASE")).toBe(false);
			expect(isPascalCase("useHTMLBox")).toBe(false);
			expect(isPascalCase("HTMLParser")).toBe(false);
			expect(isPascalCase("sYlLyCaSe")).toBe(false);
			expect(isPascalCase("SyLlYcAsE")).toBe(true);
			expect(isPascalCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isPascalCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isPathCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isPathCase("camelCase")).toBe(false);
			expect(isPathCase("CONSTANT_CASE")).toBe(false);
			expect(isPathCase("dot.case")).toBe(false);
			expect(isPathCase("SCREAMING-KEBAB")).toBe(false);
			expect(isPathCase("kebab-case")).toBe(false);
			expect(isPathCase("lowercase")).toBe(true);
			expect(isPathCase("PascalCase")).toBe(false);
			expect(isPathCase("path/case")).toBe(true);
			expect(isPathCase("snake_case")).toBe(false);
			expect(isPathCase("Title Case")).toBe(false);
			expect(isPathCase("UPPERCASE")).toBe(false);
			expect(isPathCase("useHTMLBox")).toBe(false);
			expect(isPathCase("HTMLParser")).toBe(false);
			expect(isPathCase("sYlLyCaSe")).toBe(false);
			expect(isPathCase("SyLlYcAsE")).toBe(false);
			expect(isPathCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isPathCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isSnakeCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isSnakeCase("camelCase")).toBe(false);
			expect(isSnakeCase("CONSTANT_CASE")).toBe(false);
			expect(isSnakeCase("dot.case")).toBe(false);
			expect(isSnakeCase("SCREAMING-KEBAB")).toBe(false);
			expect(isSnakeCase("kebab-case")).toBe(false);
			expect(isSnakeCase("lowercase")).toBe(true);
			expect(isSnakeCase("PascalCase")).toBe(false);
			expect(isSnakeCase("path/case")).toBe(false);
			expect(isSnakeCase("snake_case")).toBe(true);
			expect(isSnakeCase("Title Case")).toBe(false);
			expect(isSnakeCase("UPPERCASE")).toBe(false);
			expect(isSnakeCase("useHTMLBox")).toBe(false);
			expect(isSnakeCase("HTMLParser")).toBe(false);
			expect(isSnakeCase("sYlLyCaSe")).toBe(false);
			expect(isSnakeCase("SyLlYcAsE")).toBe(false);
			expect(isSnakeCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isSnakeCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isTitleCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isTitleCase("camelCase")).toBe(false);
			expect(isTitleCase("CONSTANT_CASE")).toBe(false);
			expect(isTitleCase("dot.case")).toBe(false);
			expect(isTitleCase("SCREAMING-KEBAB")).toBe(false);
			expect(isTitleCase("kebab-case")).toBe(false);
			expect(isTitleCase("lowercase")).toBe(false);
			expect(isTitleCase("PascalCase")).toBe(false);
			expect(isTitleCase("path/case")).toBe(false);
			expect(isTitleCase("snake_case")).toBe(false);
			expect(isTitleCase("Title Case")).toBe(true);
			expect(isTitleCase("UPPERCASE")).toBe(true);
			expect(isTitleCase("useHTMLBox")).toBe(false);
			expect(isTitleCase("HTMLParser")).toBe(false);
			expect(isTitleCase("sYlLyCaSe")).toBe(false);
			expect(isTitleCase("SyLlYcAsE")).toBe(false);
			expect(isTitleCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isTitleCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isUpperCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isUpperCase("camelCase")).toBe(false);
			expect(isUpperCase("CONSTANT_CASE")).toBe(false);
			expect(isUpperCase("dot.case")).toBe(false);
			expect(isUpperCase("SCREAMING-KEBAB")).toBe(false);
			expect(isUpperCase("kebab-case")).toBe(false);
			expect(isUpperCase("lowercase")).toBe(false);
			expect(isUpperCase("PascalCase")).toBe(false);
			expect(isUpperCase("path/case")).toBe(false);
			expect(isUpperCase("snake_case")).toBe(false);
			expect(isUpperCase("UPPERCASE")).toBe(true);
			expect(isUpperCase("Title Case")).toBe(false);
			expect(isUpperCase("useHTMLBox")).toBe(false);
			expect(isUpperCase("HTMLParser")).toBe(false);
			expect(isUpperCase("sYlLyCaSe")).toBe(false);
			expect(isUpperCase("SyLlYcAsE")).toBe(false);
			expect(isUpperCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isUpperCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("isUnknown", () => {
		it("should work", () => {
			expect.assertions(2);
			expect(isUnknown("camelCase")).toBe(true);
			expect(isUnknown("UPPERCASE")).toBe(true);
		});
	});

	describe("toCamelCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toCamelCase("camelCase")).toBe("camelCase");
			expect(toCamelCase("CONSTANT_CASE")).toBe("constantCase");
			expect(toCamelCase("dot.case")).toBe("dotCase");
			expect(toCamelCase("SCREAMING-KEBAB")).toBe("screamingKebab");
			expect(toCamelCase("kebab-case")).toBe("kebabCase");
			expect(toCamelCase("lowercase")).toBe("lowercase");
			expect(toCamelCase("PascalCase")).toBe("pascalCase");
			expect(toCamelCase("path/case")).toBe("pathCase");
			expect(toCamelCase("snake_case")).toBe("snakeCase");
			expect(toCamelCase("UPPERCASE")).toBe("uppercase");
			expect(toCamelCase("Title Case")).toBe("titleCase");
			expect(toCamelCase("useHTMLBox")).toBe("useHtmlBox");
			expect(toCamelCase("HTMLParser")).toBe("htmlParser");
			expect(toCamelCase("sYlLyCaSe")).toBe("sYlLyCaSe");
			expect(toCamelCase("SyLlYcAsE")).toBe("syLlYcAsE");
			expect(toCamelCase(" _TEST_FOOBar-baz baz")).toBe("testFooBarBazBaz");
			expect(toCamelCase("  multi UPPER word  ")).toBe("multiUpperWord");
		});

		it("should preserve newlines while casing each line", () => {
			expect.assertions(7);
			const value = "Fort Worth\nPittsburgh\nSan José";

			expect(toCamelCase(value)).toBe("fortWorth\npittsburgh\nsanJosé");
			expect(toKebabCase(value)).toBe("fort-worth\npittsburgh\nsan-josé");
			expect(toLowerCase(value)).toBe("fort worth\npittsburgh\nsan josé");
			expect(toSpaceCase("Fort\r\nWorth")).toBe("Fort\r\nWorth");
			expect(isCamelCase("fort\nworth")).toBe(true);
			expect(isCamelCase("fort \nworth")).toBe(false);
			expect(isTitleCase("Fort\r\nWorth")).toBe(true);
		});

		it("should preserve existing non-ASCII word-initial casing behavior", () => {
			expect.assertions(3);
			expect(toCamelCase("ÉCLAIR CAFÉ")).toBe("éclairCafé");
			expect(toPascalCase("ÉCLAIR CAFÉ")).toBe("éclairCafé");
			expect(toTitleCase("éclair café")).toBe("éclair Café");
		});

		it("supports locale mode casing", () => {
			expect.assertions(8);
			setLocaleMode(true);
			expect(toUpperCase("istanbul")).toBe("ISTANBUL");
			expect(toLowerCase("İSTANBUL")).toBe("i̇stanbul");
			expect(isUpperCase("İSTANBUL")).toBe(true);
			expect(isLowerCase("i̇stanbul")).toBe(true);
			expect(isUpperCase("ẞ")).toBe(true);
			setLocaleMode(false);
			expect(toUpperCase("mixed")).toBe("MIXED");
			expect(toUpperCase("éclair")).toBe("ÉCLAIR");
			expect(toLowerCase("MIXED")).toBe("mixed");
		});
	});

	describe("toConstantCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toConstantCase("camelCase")).toBe("CAMEL_CASE");
			expect(toConstantCase("CONSTANT_CASE")).toBe("CONSTANT_CASE");
			expect(toConstantCase("dot.case")).toBe("DOT_CASE");
			expect(toConstantCase("SCREAMING-KEBAB")).toBe("SCREAMING_KEBAB");
			expect(toConstantCase("kebab-case")).toBe("KEBAB_CASE");
			expect(toConstantCase("lowercase")).toBe("LOWERCASE");
			expect(toConstantCase("PascalCase")).toBe("PASCAL_CASE");
			expect(toConstantCase("path/case")).toBe("PATH_CASE");
			expect(toConstantCase("snake_case")).toBe("SNAKE_CASE");
			expect(toConstantCase("Title Case")).toBe("TITLE_CASE");
			expect(toConstantCase("UPPERCASE")).toBe("UPPERCASE");
			expect(toConstantCase("useHTMLBox")).toBe("USE_HTML_BOX");
			expect(toConstantCase("HTMLParser")).toBe("HTML_PARSER");
			expect(toConstantCase("sYlLyCaSe")).toBe("S_YL_LY_CA_SE");
			expect(toConstantCase("SyLlYcAsE")).toBe("SY_LL_YC_AS_E");
			expect(toConstantCase(" _TEST_FOOBar-baz baz")).toBe("TEST_FOO_BAR_BAZ_BAZ");
			expect(toConstantCase("  multi UPPER word  ")).toBe("MULTI_UPPER_WORD");
		});
	});

	describe("toDotCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toDotCase("camelCase")).toBe("camel.case");
			expect(toDotCase("CONSTANT_CASE")).toBe("constant.case");
			expect(toDotCase("dot.case")).toBe("dot.case");
			expect(toDotCase("SCREAMING-KEBAB")).toBe("screaming.kebab");
			expect(toDotCase("kebab-case")).toBe("kebab.case");
			expect(toDotCase("lowercase")).toBe("lowercase");
			expect(toDotCase("PascalCase")).toBe("pascal.case");
			expect(toDotCase("path/case")).toBe("path.case");
			expect(toDotCase("snake_case")).toBe("snake.case");
			expect(toDotCase("Title Case")).toBe("title.case");
			expect(toDotCase("UPPERCASE")).toBe("uppercase");
			expect(toDotCase("useHTMLBox")).toBe("use.html.box");
			expect(toDotCase("HTMLParser")).toBe("html.parser");
			expect(toDotCase("sYlLyCaSe")).toBe("s.yl.ly.ca.se");
			expect(toDotCase("SyLlYcAsE")).toBe("sy.ll.yc.as.e");
			expect(toDotCase(" _TEST_FOOBar-baz baz")).toBe("test.foo.bar.baz.baz");
			expect(toDotCase("  multi UPPER word  ")).toBe("multi.upper.word");
		});
	});

	describe("toKebabCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toKebabCase("camelCase")).toBe("camel-case");
			expect(toKebabCase("CONSTANT_CASE")).toBe("constant-case");
			expect(toKebabCase("dot.case")).toBe("dot-case");
			expect(toKebabCase("SCREAMING-KEBAB")).toBe("screaming-kebab");
			expect(toKebabCase("kebab-case")).toBe("kebab-case");
			expect(toKebabCase("lowercase")).toBe("lowercase");
			expect(toKebabCase("PascalCase")).toBe("pascal-case");
			expect(toKebabCase("path/case")).toBe("path-case");
			expect(toKebabCase("snake_case")).toBe("snake-case");
			expect(toKebabCase("Title Case")).toBe("title-case");
			expect(toKebabCase("UPPERCASE")).toBe("uppercase");
			expect(toKebabCase("useHTMLBox")).toBe("use-html-box");
			expect(toKebabCase("HTMLParser")).toBe("html-parser");
			expect(toKebabCase("sYlLyCaSe")).toBe("s-yl-ly-ca-se");
			expect(toKebabCase("SyLlYcAsE")).toBe("sy-ll-yc-as-e");
			expect(toKebabCase(" _TEST_FOOBar-baz baz")).toBe("test-foo-bar-baz-baz");
			expect(toKebabCase("  multi UPPER word  ")).toBe("multi-upper-word");
		});
	});

	describe("toLowerCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toLowerCase("camelCase")).toBe("camel case");
			expect(toLowerCase("CONSTANT_CASE")).toBe("constant case");
			expect(toLowerCase("dot.case")).toBe("dot case");
			expect(toLowerCase("SCREAMING-KEBAB")).toBe("screaming kebab");
			expect(toLowerCase("kebab-case")).toBe("kebab case");
			expect(toLowerCase("lowercase")).toBe("lowercase");
			expect(toLowerCase("PascalCase")).toBe("pascal case");
			expect(toLowerCase("path/case")).toBe("path case");
			expect(toLowerCase("snake_case")).toBe("snake case");
			expect(toLowerCase("Title Case")).toBe("title case");
			expect(toLowerCase("UPPERCASE")).toBe("uppercase");
			expect(toLowerCase("useHTMLBox")).toBe("use html box");
			expect(toLowerCase("HTMLParser")).toBe("html parser");
			expect(toLowerCase("sYlLyCaSe")).toBe("s yl ly ca se");
			expect(toLowerCase("SyLlYcAsE")).toBe("sy ll yc as e");
			expect(toLowerCase(" _TEST_FOOBar-baz baz")).toBe("test foo bar baz baz");
			expect(toLowerCase("  multi UPPER word  ")).toBe("multi upper word");
		});
	});

	describe("toPascalCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toPascalCase("camelCase")).toBe("CamelCase");
			expect(toPascalCase("CONSTANT_CASE")).toBe("ConstantCase");
			expect(toPascalCase("dot.case")).toBe("DotCase");
			expect(toPascalCase("SCREAMING-KEBAB")).toBe("ScreamingKebab");
			expect(toPascalCase("kebab-case")).toBe("KebabCase");
			expect(toPascalCase("lowercase")).toBe("Lowercase");
			expect(toPascalCase("PascalCase")).toBe("PascalCase");
			expect(toPascalCase("path/case")).toBe("PathCase");
			expect(toPascalCase("snake_case")).toBe("SnakeCase");
			expect(toPascalCase("Title Case")).toBe("TitleCase");
			expect(toPascalCase("UPPERCASE")).toBe("Uppercase");
			expect(toPascalCase("useHTMLBox")).toBe("UseHtmlBox");
			expect(toPascalCase("HTMLParser")).toBe("HtmlParser");
			expect(toPascalCase("sYlLyCaSe")).toBe("SYlLyCaSe");
			expect(toPascalCase("SyLlYcAsE")).toBe("SyLlYcAsE");
			expect(toPascalCase(" _TEST_FOOBar-baz baz")).toBe("TestFooBarBazBaz");
			expect(toPascalCase("  multi UPPER word  ")).toBe("MultiUpperWord");
		});
	});

	describe("toPathCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toPathCase("camelCase")).toBe("camel/case");
			expect(toPathCase("CONSTANT_CASE")).toBe("constant/case");
			expect(toPathCase("dot.case")).toBe("dot/case");
			expect(toPathCase("SCREAMING-KEBAB")).toBe("screaming/kebab");
			expect(toPathCase("kebab-case")).toBe("kebab/case");
			expect(toPathCase("lowercase")).toBe("lowercase");
			expect(toPathCase("PascalCase")).toBe("pascal/case");
			expect(toPathCase("path/case")).toBe("path/case");
			expect(toPathCase("snake_case")).toBe("snake/case");
			expect(toPathCase("Title Case")).toBe("title/case");
			expect(toPathCase("UPPERCASE")).toBe("uppercase");
			expect(toPathCase("useHTMLBox")).toBe("use/html/box");
			expect(toPathCase("HTMLParser")).toBe("html/parser");
			expect(toPathCase("sYlLyCaSe")).toBe("s/yl/ly/ca/se");
			expect(toPathCase("SyLlYcAsE")).toBe("sy/ll/yc/as/e");
			expect(toPathCase(" _TEST_FOOBar-baz baz")).toBe("test/foo/bar/baz/baz");
			expect(toPathCase("  multi UPPER word  ")).toBe("multi/upper/word");
		});
	});

	describe("toSnakeCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toSnakeCase("camelCase")).toBe("camel_case");
			expect(toSnakeCase("CONSTANT_CASE")).toBe("constant_case");
			expect(toSnakeCase("dot.case")).toBe("dot_case");
			expect(toSnakeCase("SCREAMING-KEBAB")).toBe("screaming_kebab");
			expect(toSnakeCase("kebab-case")).toBe("kebab_case");
			expect(toSnakeCase("lowercase")).toBe("lowercase");
			expect(toSnakeCase("PascalCase")).toBe("pascal_case");
			expect(toSnakeCase("path/case")).toBe("path_case");
			expect(toSnakeCase("snake_case")).toBe("snake_case");
			expect(toSnakeCase("Title Case")).toBe("title_case");
			expect(toSnakeCase("UPPERCASE")).toBe("uppercase");
			expect(toSnakeCase("useHTMLBox")).toBe("use_html_box");
			expect(toSnakeCase("HTMLParser")).toBe("html_parser");
			expect(toSnakeCase("sYlLyCaSe")).toBe("s_yl_ly_ca_se");
			expect(toSnakeCase("SyLlYcAsE")).toBe("sy_ll_yc_as_e");
			expect(toSnakeCase(" _TEST_FOOBar-baz baz")).toBe("test_foo_bar_baz_baz");
			expect(toSnakeCase("  multi UPPER word  ")).toBe("multi_upper_word");
		});
	});

	describe("toTitleCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toTitleCase("camelCase")).toBe("Camel Case");
			expect(toTitleCase("CONSTANT_CASE")).toBe("CONSTANT CASE");
			expect(toTitleCase("dot.case")).toBe("Dot Case");
			expect(toTitleCase("SCREAMING-KEBAB")).toBe("SCREAMING KEBAB");
			expect(toTitleCase("kebab-case")).toBe("Kebab Case");
			expect(toTitleCase("lowercase")).toBe("Lowercase");
			expect(toTitleCase("PascalCase")).toBe("Pascal Case");
			expect(toTitleCase("path/case")).toBe("Path Case");
			expect(toTitleCase("snake_case")).toBe("Snake Case");
			expect(toTitleCase("Title Case")).toBe("Title Case");
			expect(toTitleCase("UPPERCASE")).toBe("UPPERCASE");
			expect(toTitleCase("useHTMLBox")).toBe("Use HTML Box");
			expect(toTitleCase("HTMLParser")).toBe("HTML Parser");
			expect(toTitleCase("sYlLyCaSe")).toBe("S Yl Ly Ca Se");
			expect(toTitleCase("SyLlYcAsE")).toBe("Sy Ll Yc As E");
			expect(toTitleCase(" _TEST_FOOBar-baz baz")).toBe("TEST FOO Bar Baz Baz");
			expect(toTitleCase("  multi UPPER word  ")).toBe("Multi UPPER Word");
		});
	});

	describe("toUpperCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(toUpperCase("camelCase")).toBe("CAMEL CASE");
			expect(toUpperCase("CONSTANT_CASE")).toBe("CONSTANT CASE");
			expect(toUpperCase("dot.case")).toBe("DOT CASE");
			expect(toUpperCase("SCREAMING-KEBAB")).toBe("SCREAMING KEBAB");
			expect(toUpperCase("kebab-case")).toBe("KEBAB CASE");
			expect(toUpperCase("lowercase")).toBe("LOWERCASE");
			expect(toUpperCase("PascalCase")).toBe("PASCAL CASE");
			expect(toUpperCase("path/case")).toBe("PATH CASE");
			expect(toUpperCase("snake_case")).toBe("SNAKE CASE");
			expect(toUpperCase("Title Case")).toBe("TITLE CASE");
			expect(toUpperCase("UPPERCASE")).toBe("UPPERCASE");
			expect(toUpperCase("useHTMLBox")).toBe("USE HTML BOX");
			expect(toUpperCase("HTMLParser")).toBe("HTML PARSER");
			expect(toUpperCase("sYlLyCaSe")).toBe("S YL LY CA SE");
			expect(toUpperCase("SyLlYcAsE")).toBe("SY LL YC AS E");
			expect(toUpperCase(" _TEST_FOOBar-baz baz")).toBe("TEST FOO BAR BAZ BAZ");
			expect(toUpperCase("  multi UPPER word  ")).toBe("MULTI UPPER WORD");
		});
	});

	describe("apply", () => {
		it("should work", () => {
			expect.assertions(11);
			expect(apply("some EXAMPLE", Casing.CamelCase)).toBe("someExample");
			expect(apply("some EXAMPLE", Casing.ConstantCase)).toBe("SOME_EXAMPLE");
			expect(apply("some EXAMPLE", Casing.DotCase)).toBe("some.example");
			expect(apply("some EXAMPLE", Casing.KebabCase)).toBe("some-example");
			expect(apply("some EXAMPLE", Casing.LowerCase)).toBe("some example");
			expect(apply("some EXAMPLE", Casing.PascalCase)).toBe("SomeExample");
			expect(apply("some EXAMPLE", Casing.PathCase)).toBe("some/example");
			expect(apply("some EXAMPLE", Casing.SnakeCase)).toBe("some_example");
			expect(apply("some EXAMPLE", Casing.TitleCase)).toBe("Some EXAMPLE");
			expect(apply("some EXAMPLE", Casing.Unknown)).toBe("some EXAMPLE");
			expect(apply("some EXAMPLE", Casing.UpperCase)).toBe("SOME EXAMPLE");
		});
	});

	describe("copy", () => {
		it("should work", () => {
			expect.assertions(7);
			expect(copy("sIlLy", "lions")).toBe("lIoNs");
			expect(copy("SiLlY", "lions")).toBe("LiOnS");
			expect(copy("silly", "LIONS")).toBe("lions");
			expect(copy("éa", "ÉB")).toBe("éb");
			expect(copy("😄a", "😄a")).toBe("😄a");
			expect(copy("", "value")).toBe("value");
			expect(copy("abc", "abcd")).toBe("abcd");
		});

		it("copies uppercase grapheme casing to the next string", () => {
			expect.assertions(1);
			expect(copy("Éa", "éb")).toBe("Éb");
		});

		it("should throw when grapheme counts do not align", () => {
			expect.assertions(1);
			expect(() => copy("abc", "😄a")).toThrow("Unexpected undefined character");
		});
	});

	describe("isCamelCase", () => {
		it("should work", () => {
			expect.assertions(17);
			expect(isCamelCase("camelCase")).toBe(true);
			expect(isCamelCase("CONSTANT_CASE")).toBe(false);
			expect(isCamelCase("dot.case")).toBe(false);
			expect(isCamelCase("SCREAMING-KEBAB")).toBe(false);
			expect(isCamelCase("kebab-case")).toBe(false);
			expect(isCamelCase("lowercase")).toBe(true);
			expect(isCamelCase("PascalCase")).toBe(false);
			expect(isCamelCase("path/case")).toBe(false);
			expect(isCamelCase("snake_case")).toBe(false);
			expect(isCamelCase("Title Case")).toBe(false);
			expect(isCamelCase("UPPERCASE")).toBe(false);
			expect(isCamelCase("useHTMLBox")).toBe(false);
			expect(isCamelCase("HTMLParser")).toBe(false);
			expect(isCamelCase("sYlLyCaSe")).toBe(true);
			expect(isCamelCase("SyLlYcAsE")).toBe(false);
			expect(isCamelCase(" _TEST_FOOBar-baz baz")).toBe(false);
			expect(isCamelCase("  multi UPPER word  ")).toBe(false);
		});
	});

	describe("detect", () => {
		it("should work", () => {
			expect.assertions(21);
			expect(detect("")).toBe(Casing.Unknown);
			expect(detect("camelCase")).toBe(Casing.CamelCase);
			expect(detect("CONSTANT_CASE")).toBe(Casing.ConstantCase);
			expect(detect("MIXED_CASE")).toBe(Casing.ConstantCase);
			expect(detect("mixed_CASE")).toBe(Casing.Unknown);
			expect(detect("dot.case")).toBe(Casing.DotCase);
			expect(detect("mixed.Case")).toBe(Casing.Unknown);
			expect(detect("SCREAMING-KEBAB")).toBe(Casing.Unknown);
			expect(detect("kebab-case")).toBe(Casing.KebabCase);
			expect(detect("lowercase")).toBe(Casing.LowerCase);
			expect(detect("PascalCase")).toBe(Casing.PascalCase);
			expect(detect("path/case")).toBe(Casing.PathCase);
			expect(detect("snake_case")).toBe(Casing.SnakeCase);
			expect(detect("Title Case")).toBe(Casing.TitleCase);
			expect(detect("UPPERCASE")).toBe(Casing.UpperCase);
			expect(detect("useHTMLBox")).toBe(Casing.Unknown);
			expect(detect("HTMLParser")).toBe(Casing.Unknown);
			expect(detect("sYlLyCaSe")).toBe(Casing.CamelCase);
			expect(detect("SyLlYcAsE")).toBe(Casing.PascalCase);
			expect(detect(" _TEST_FOOBar-baz baz")).toBe(Casing.Unknown);
			expect(detect("  multi UPPER word  ")).toBe(Casing.Unknown);
		});
	});
});
