#!/usr/bin/env bun
/**
 * Analyzes CPU profiles for ESLint rule profiling.
 */

import { readFileSync } from "node:fs";
import { type } from "arktype";

const isCallFrame = type({
	columnNumber: "number % 1",
	functionName: "string",
	lineNumber: "number % 1",
	scriptId: "string",
	url: "string",
}).readonly();

const isProfileNode = type({
	callFrame: isCallFrame,
	"children?": type("number[]").readonly(),
	"hitCount?": "number % 1",
	id: "number % 1",
}).readonly();

const isCpuProfile = type({
	endTime: "number % 1",
	nodes: isProfileNode.array().readonly(),
	samples: type("number[]").readonly(),
	startTime: "number % 1",
	timeDeltas: type("number[]").readonly(),
}).readonly();

interface FunctionStats {
	readonly name: string;
	readonly file: string;
	readonly line: number;
	selfTime: number;
	samples: number;
}

const NODE_MODULES_PATTERN = /node_modules\/(@[^/]+\/[^/]+|[^/]+)/;
const RULES_PATTERN = /\/src\/rules\/([^.]+)/;
const SRC_PATTERN = /\/src\/([^/]+)/;
const NM_REPLACE_PATTERN = /.*node_modules\//;
const DENPASAR_PATH = "file:///Users/loganhamilton/conductor/workspaces/eslint-idiot-lint/denpasar/";

function sortBySelfTime(first: FunctionStats, second: FunctionStats): number {
	return second.selfTime - first.selfTime;
}

function sortModulesByTime(first: [string, number], second: [string, number]): number {
	return second[1] - first[1];
}

function analyzeProfile(profilePath: string): void {
	const profileContent = readFileSync(profilePath, "utf8");
	const profile = isCpuProfile(JSON.parse(profileContent));
	if (profile instanceof type.errors) {
		throw new TypeError(`Invalid CPU profile at ${profilePath} - ${profile.summary}`);
	}

	const totalSamples = profile.samples.length;
	const totalTimeUs = profile.timeDeltas.reduce((sum, delta) => sum + delta, 0);
	const totalTimeMs = totalTimeUs / 1000;

	// Count samples per node
	const sampleCounts = new Map<number, number>();
	for (const sample of profile.samples) {
		sampleCounts.set(sample, (sampleCounts.get(sample) ?? 0) + 1);
	}

	// Aggregate stats by function
	const functionStats = new Map<string, FunctionStats>();

	for (const node of profile.nodes) {
		const { callFrame } = node;
		const selfSamples = sampleCounts.get(node.id) ?? 0;

		if (selfSamples === 0) continue;

		const key = `${callFrame.functionName}|${callFrame.url}|${callFrame.lineNumber}`;

		const existing = functionStats.get(key);
		if (existing) {
			existing.selfTime += selfSamples;
			existing.samples += selfSamples;
		} else {
			functionStats.set(key, {
				file: callFrame.url,
				line: callFrame.lineNumber,
				name: callFrame.functionName,
				samples: selfSamples,
				selfTime: selfSamples,
			});
		}
	}

	const sorted = [...functionStats.values()];
	sorted.sort(sortBySelfTime);

	// Print results
	console.log(`\n${"=".repeat(120)}`);
	console.log(`PROFILE: ${profilePath.split("/").pop()}`);
	console.log("=".repeat(120));
	console.log(`Total Samples: ${totalSamples}`);
	console.log(`Total Time: ${totalTimeMs.toFixed(2)}ms`);
	console.log(`Sample Rate: ${((totalSamples / totalTimeMs) * 1000).toFixed(0)} samples/sec`);
	console.log("");

	console.log("TOP 40 FUNCTIONS BY SELF TIME:");
	console.log("-".repeat(120));
	console.log(`${"% Self".padStart(8)} | ${"Samples".padStart(8)} | ${"Function".padEnd(50)} | Location`);
	console.log("-".repeat(120));

	for (const stats of sorted.slice(0, 40)) {
		const pct = ((stats.selfTime / totalSamples) * 100).toFixed(2);
		const funcName = (stats.name ?? "(anonymous)").slice(0, 50).padEnd(50);

		let location = stats.file
			.replace(DENPASAR_PATH, "")
			.replace(NM_REPLACE_PATTERN, "nm/")
			.replace("node:internal/", "node:");

		if (stats.line > 0) {
			location = `${location}:${stats.line}`;
		}

		if (location.length > 50) {
			location = `...${location.slice(-47)}`;
		}

		console.log(`${pct.padStart(7)}% | ${String(stats.selfTime).padStart(8)} | ${funcName} | ${location}`);
	}

	// Group by file/module
	console.log("\n\nBREAKDOWN BY MODULE:");
	console.log("-".repeat(120));

	const moduleStats = new Map<string, number>();
	for (const stats of sorted) {
		let moduleName = stats.file;

		if (moduleName.includes("node_modules/")) {
			const match = NODE_MODULES_PATTERN.exec(moduleName);
			moduleName = match?.[1] ?? "node_modules";
		} else if (moduleName.startsWith("node:")) {
			moduleName = "node:internals";
		} else if (moduleName.includes("/src/rules/")) {
			const match = RULES_PATTERN.exec(moduleName);
			moduleName = match ? `rules/${match[1]}` : "rules";
		} else if (moduleName.includes("/src/recognizers/")) {
			moduleName = "src/recognizers";
		} else if (moduleName.includes("/src/utilities/")) {
			moduleName = "src/utilities";
		} else if (moduleName.includes("/src/")) {
			const match = SRC_PATTERN.exec(moduleName);
			moduleName = match ? `src/${match[1]}` : "src/other";
		} else if (moduleName.includes("profile-rule.js")) {
			moduleName = "bundled-code";
		} else {
			moduleName = moduleName.split("/").pop() ?? moduleName;
		}

		moduleStats.set(moduleName, (moduleStats.get(moduleName) ?? 0) + stats.selfTime);
	}

	const sortedModules = [...moduleStats.entries()];
	sortedModules.sort(sortModulesByTime);

	console.log(`${"% Time".padStart(8)} | ${"Samples".padStart(8)} | Module`);
	console.log("-".repeat(120));

	for (const [moduleName, samples] of sortedModules.slice(0, 25)) {
		const pct = ((samples / totalSamples) * 100).toFixed(2);
		console.log(`${pct.padStart(7)}% | ${String(samples).padStart(8)} | ${moduleName}`);
	}

	// Show bundled code line numbers for later mapping
	console.log("\n\nBUNDLED CODE HOTSPOTS (for sourcemap lookup):");
	console.log("-".repeat(120));

	const bundledHotspots = sorted
		.filter((stat) => stat.file.includes("profile-rule.js") && stat.selfTime > 5)
		.slice(0, 30);

	console.log(`${"% Time".padStart(8)} | ${"Samples".padStart(8)} | ${"Line".padStart(8)} | Function Name`);
	console.log("-".repeat(120));

	for (const stats of bundledHotspots) {
		const pct = ((stats.selfTime / totalSamples) * 100).toFixed(2);
		console.log(
			`${pct.padStart(7)}% | ${String(stats.selfTime).padStart(8)} | ${String(stats.line).padStart(8)} | ${stats.name ?? "(anonymous)"}`,
		);
	}
}

const profiles = [
	"no-shorthand-names-detailed.cpuprofile",
	"no-commented-code-detailed.cpuprofile",
	"require-paired-calls-detailed.cpuprofile",
	"use-exhaustive-dependencies-detailed.cpuprofile",
	"use-hook-at-top-level-detailed.cpuprofile",
];

const baseDir = "/Users/loganhamilton/conductor/workspaces/eslint-idiot-lint/denpasar/profiles";

for (const profile of profiles) {
	const profilePath = `${baseDir}/${profile}`;
	try {
		analyzeProfile(profilePath);
	} catch (error) {
		console.error(`Failed to analyze ${profile}:`, error);
	}
}
