/**
 * Fuzzy matches two strings using trigram similarity (similar to Postgres pg_trgm).
 * Useful for matching names like "Joseph Morgan" with "Joe Morgan" or "Grandpa Joe".
 * Returns a score between 0.0 and 1.0. Higher is better.
 */

// Helper: generate trigrams for a string
function getTrigrams(str) {
    if (typeof str !== 'string') return new Set();
    const cleanStr = '  ' + str.toLowerCase().replace(/[^a-z0-9]/g, '') + '  ';
    const trigrams = new Set();
    for (let i = 0; i < cleanStr.length - 2; i++) {
        trigrams.add(cleanStr.substring(i, i + 3));
    }
    return trigrams;
}

export function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0.0;
    
    // Exact match gets perfect score
    if (str1.toLowerCase().trim() === str2.toLowerCase().trim()) return 1.0;

    const t1 = getTrigrams(str1);
    const t2 = getTrigrams(str2);

    if (t1.size === 0 && t2.size === 0) return !!(str1 === str2) ? 1.0 : 0.0;
    if (t1.size === 0 || t2.size === 0) return 0.0;

    let intersectionSize = 0;
    for (const trigram of t1) {
        if (t2.has(trigram)) {
            intersectionSize++;
        }
    }

    // Sorensen-Dice coefficient
    return (2.0 * intersectionSize) / (t1.size + t2.size);
}

/**
 * Given an incoming person name and a list of existing persons, returns the best match
 * if the confidence score is above a certain threshold (e.g. 0.4).
 * Returns { match: existingPersonObj, score: number } or null.
 */
export function findBestMatch(incomingName, existingPersonsList, threshold = 0.45) {
    if (!incomingName || !existingPersonsList || existingPersonsList.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    // We tokenize the incoming name to help match "Grandpa Joe" with "Joseph Joe Morgan"
    const incomingTokens = incomingName.toLowerCase().split(/\s+/).filter(Boolean);

    for (const existing of existingPersonsList) {
        if (!existing.display_name) continue;
        
        // 1. Full string Trigram similarity
        const baseScore = calculateSimilarity(incomingName, existing.display_name);

        // 2. Token overlap bonus (e.g. if "Joe" is in both "Grandpa Joe" and "Joe Morgan")
        const existingTokens = existing.display_name.toLowerCase().split(/\s+/).filter(Boolean);
        let tokenMatches = 0;
        for (const t of incomingTokens) {
            if (existingTokens.includes(t)) tokenMatches++;
        }
        const tokenBonus = (tokenMatches > 0) ? (tokenMatches / Math.max(incomingTokens.length, existingTokens.length)) * 0.3 : 0;

        const finalScore = Math.min(1.0, baseScore + tokenBonus);

        if (finalScore > highestScore) {
            highestScore = finalScore;
            bestMatch = existing;
        }
    }

    if (highestScore >= threshold) {
        return { match: bestMatch, score: highestScore };
    }

    return null;
}
