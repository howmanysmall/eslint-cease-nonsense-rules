/**
 * Utility for sharding test cases across multiple CI jobs.
 *
 * When TEST_CASE_SHARD environment variable is set (format: "index/total"),
 * returns a filtered subset of cases. Otherwise returns all cases unchanged.
 *
 * This enables parallel execution of heavy test files without affecting local development.
 *
 * @param cases - Array of test cases to potentially shard
 * @returns The full array if TEST_CASE_SHARD is not set, otherwise a filtered subset
 *
 * @example
 * // Local development - no filtering
 * const cases = shardCases([1, 2, 3, 4]); // Returns [1, 2, 3, 4]
 *
 * @example
 * // CI with TEST_CASE_SHARD=1/4
 * const cases = shardCases([1, 2, 3, 4, 5, 6, 7, 8]); // Returns [1, 5] (indices 0, 4)
 *
 * @example
 * // CI with TEST_CASE_SHARD=2/4
 * const cases = shardCases([1, 2, 3, 4, 5, 6, 7, 8]); // Returns [2, 6] (indices 1, 5)
 */
export function shardCases<TestCase>(cases: ReadonlyArray<TestCase>): ReadonlyArray<TestCase> {
	const shardEnv = Bun.env.TEST_CASE_SHARD;

	// No sharding - return all cases (local development)
	if (!shardEnv) return cases;

	// Parse shard specification
	const parts = shardEnv.split("/");
	if (parts.length !== 2) {
		throw new TypeError(`Invalid TEST_CASE_SHARD format: expected "index/total", got "${shardEnv}"`);
	}

	const shardIndex = Number.parseInt(parts[0], 10);
	const totalShards = Number.parseInt(parts[1], 10);

	if (Number.isNaN(shardIndex) || Number.isNaN(totalShards)) {
		throw new TypeError(`Invalid TEST_CASE_SHARD format: non-numeric values in "${shardEnv}"`);
	}

	if (shardIndex < 1 || shardIndex > totalShards) {
		throw new TypeError(`Invalid TEST_CASE_SHARD: index ${shardIndex} out of range [1, ${totalShards}]`);
	}

	// Use round-robin distribution for even load balancing
	// Shard index is 1-based, so convert to 0-based for modulo arithmetic
	return cases.filter((_case, index) => index % totalShards === shardIndex - 1);
}
