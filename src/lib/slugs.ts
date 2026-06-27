const SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
	[/&/g, ' and '],
	[/\+/g, ' plus '],
	[/@/g, ' at '],
	[/%/g, ' percent '],
];

const LETTER_REPLACEMENTS: Array<[RegExp, string]> = [
	[/ß/g, 'ss'],
	[/æ/g, 'ae'],
	[/œ/g, 'oe'],
	[/ø/g, 'o'],
	[/đ/g, 'd'],
	[/þ/g, 'th'],
	[/ł/g, 'l'],
];

export const normalizeSlug = (value: string): string => {
	let slug = value
		.trim()
		.replace(/^#{1,6}\s*/, '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/['’‘`]/g, '');

	for (const [pattern, replacement] of LETTER_REPLACEMENTS) {
		slug = slug.replace(pattern, replacement);
	}

	for (const [pattern, replacement] of SYMBOL_REPLACEMENTS) {
		slug = slug.replace(pattern, replacement);
	}

	return slug
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '');
};
