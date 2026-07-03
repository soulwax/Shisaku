export const normalizeTags = (value: string | string[] | undefined): string[] => {
	const values = Array.isArray(value) ? value : (value ?? '').split(',');
	return [...new Set(values.map((tag) => tag.trim().replace(/^\+/, '')).filter(Boolean))];
};

export interface TagChanges {
	tags?: string[];
	addTags?: string[];
	removeTags?: string[];
}

/**
 * Computes the next tag list for a post. `tags` replaces the whole list and
 * wins over the incremental fields; otherwise `addTags` are appended (existing
 * duplicates are kept once) and `removeTags` are dropped. Removal matches
 * case-insensitively so automation does not need to know the stored casing.
 */
export const applyTagChanges = (current: string[], changes: TagChanges): string[] => {
	if (changes.tags !== undefined) {
		return normalizeTags(changes.tags);
	}

	let next = normalizeTags([...current, ...(changes.addTags ?? [])]);

	if (changes.removeTags?.length) {
		const removals = new Set(normalizeTags(changes.removeTags).map((tag) => tag.toLowerCase()));
		next = next.filter((tag) => !removals.has(tag.toLowerCase()));
	}

	return next;
};
