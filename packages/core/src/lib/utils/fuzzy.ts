/**
 * Fuzzy search utilities for column/field picker
 */

export interface FuzzyMatch {
	/** The original string that was matched */
	text: string;
	/** The match score (higher = better match) */
	score: number;
	/** Indices of characters that matched in the original string */
	matchedIndices: number[];
}

/**
 * Perform fuzzy matching of a search pattern against a target string.
 * Returns null if no match, or a FuzzyMatch object with score and matched indices.
 *
 * Scoring:
 * - Consecutive matches score higher
 * - Matches at word boundaries score higher
 * - Matches at the start of the string score higher
 * - Case-insensitive matching
 *
 * @param pattern - The search pattern (e.g., "cdt" to find "Created Date")
 * @param target - The target string to search in
 * @returns FuzzyMatch object or null if no match
 */
export function fuzzyMatch(pattern: string, target: string): FuzzyMatch | null {
	if (!pattern) {
		return { text: target, score: 0, matchedIndices: [] };
	}

	const patternLower = pattern.toLowerCase();
	const targetLower = target.toLowerCase();

	// Quick check: all pattern characters must exist in target
	let patternIdx = 0;
	for (let i = 0; i < targetLower.length && patternIdx < patternLower.length; i++) {
		if (targetLower[i] === patternLower[patternIdx]) {
			patternIdx++;
		}
	}

	if (patternIdx !== patternLower.length) {
		return null; // Not all pattern characters found
	}

	// Find optimal match positions using greedy algorithm
	const matchedIndices: number[] = [];
	let score = 0;
	patternIdx = 0;
	let lastMatchIdx = -1;
	let consecutiveCount = 0;

	for (let i = 0; i < targetLower.length && patternIdx < patternLower.length; i++) {
		if (targetLower[i] === patternLower[patternIdx]) {
			matchedIndices.push(i);

			// Base score for match
			score += 1;

			// Bonus for consecutive matches
			if (lastMatchIdx === i - 1) {
				consecutiveCount++;
				score += consecutiveCount * 2;
			} else {
				consecutiveCount = 0;
			}

			// Bonus for match at start of string
			if (i === 0) {
				score += 10;
			}

			// Bonus for match at word boundary (after space, underscore, or uppercase)
			if (i > 0) {
				const prevChar = target[i - 1];
				const currChar = target[i];
				if (prevChar === ' ' || prevChar === '_' || prevChar === '-') {
					score += 5;
				} else if (currChar === currChar.toUpperCase() && currChar !== currChar.toLowerCase()) {
					// CamelCase boundary
					score += 3;
				}
			}

			lastMatchIdx = i;
			patternIdx++;
		}
	}

	// Bonus for shorter target strings (prefer more specific matches)
	score += Math.max(0, 20 - target.length);

	// Bonus if pattern matches significant portion of target
	const coverageRatio = pattern.length / target.length;
	score += Math.floor(coverageRatio * 10);

	return {
		text: target,
		score,
		matchedIndices
	};
}

/**
 * Search through an array of strings and return matches sorted by score.
 *
 * @param pattern - The search pattern
 * @param items - Array of strings to search
 * @param limit - Maximum number of results to return (default: all)
 * @returns Array of FuzzyMatch objects sorted by score (highest first)
 */
export function fuzzySearch(pattern: string, items: string[], limit?: number): FuzzyMatch[] {
	if (!pattern) {
		// Return all items with zero score when no pattern
		const results = items.map((text) => ({ text, score: 0, matchedIndices: [] as number[] }));
		return limit ? results.slice(0, limit) : results;
	}

	const matches: FuzzyMatch[] = [];

	for (const item of items) {
		const match = fuzzyMatch(pattern, item);
		if (match) {
			matches.push(match);
		}
	}

	// Sort by score descending
	matches.sort((a, b) => b.score - a.score);

	return limit ? matches.slice(0, limit) : matches;
}

/**
 * Highlight matched characters in a string by wrapping them in a specified tag.
 * Returns an array of segments with matched/unmatched flags for rendering.
 *
 * @param text - The original text
 * @param matchedIndices - Array of indices that matched
 * @returns Array of text segments with isMatch flag
 */
export function highlightMatches(
	text: string,
	matchedIndices: number[]
): { text: string; isMatch: boolean }[] {
	if (!matchedIndices.length) {
		return [{ text, isMatch: false }];
	}

	const matchSet = new Set(matchedIndices);
	const segments: { text: string; isMatch: boolean }[] = [];
	let currentSegment = '';
	let currentIsMatch = matchSet.has(0);

	for (let i = 0; i < text.length; i++) {
		const isMatch = matchSet.has(i);

		if (isMatch === currentIsMatch) {
			currentSegment += text[i];
		} else {
			if (currentSegment) {
				segments.push({ text: currentSegment, isMatch: currentIsMatch });
			}
			currentSegment = text[i];
			currentIsMatch = isMatch;
		}
	}

	if (currentSegment) {
		segments.push({ text: currentSegment, isMatch: currentIsMatch });
	}

	return segments;
}
