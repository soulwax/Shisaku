import markdownItShiki from '@shikijs/markdown-it';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

let rendererPromise: Promise<MarkdownIt> | undefined;

const createRenderer = async () => {
	const renderer = new MarkdownIt({
		html: false,
		linkify: true,
		typographer: true,
	});

	renderer.use(
		await markdownItShiki({
			langs: ['bash', 'c', 'cpp', 'css', 'html', 'javascript', 'json', 'lua', 'markdown', 'rust', 'toml', 'typescript', 'yaml'],
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			defaultColor: false,
			// Any fenced block tagged with a language we did not preload renders as
			// plain text instead of throwing (which would surface as a 500). 'text'
			// is Shiki's no-grammar special language (the documented default for
			// defaultLanguage); its option type is too narrow to include the literal.
			// See tests/markdown.test.ts.
			// @ts-expect-error - 'text' is a valid Shiki special language at runtime.
			fallbackLanguage: 'text',
		}),
	);

	return renderer;
};

const getRenderer = () => {
	rendererPromise ??= createRenderer();
	return rendererPromise;
};

export const renderMarkdown = async (markdown: string): Promise<string> => {
	const renderer = await getRenderer();
	const rendered = renderer.render(markdown);

	return sanitizeHtml(rendered, {
		allowedTags: [
			...sanitizeHtml.defaults.allowedTags,
			'img',
			'figure',
			'figcaption',
			'mark',
			'kbd',
			'sub',
			'sup',
			'abbr',
		],
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			a: ['href', 'name', 'target', 'rel'],
			abbr: ['title'],
			img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
			pre: ['class', 'style', 'tabindex'],
			code: ['class', 'style'],
			span: ['class', 'style'],
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		transformTags: {
			a: (_tagName, attribs) => ({
				tagName: 'a',
				attribs: {
					...attribs,
					rel: 'nofollow noopener noreferrer',
				},
			}),
			img: (_tagName, attribs) => ({
				tagName: 'img',
				attribs: {
					...attribs,
					loading: 'lazy',
				},
			}),
		},
	});
};

// Matches a backslash escaping any CommonMark ASCII punctuation character
// (the WYSIWYG editor over-escapes these when round-tripping pasted content,
// e.g. `\#`, `\*\*`, `` \` ``), capturing the punctuation so we can drop the slash.
const ESCAPED_PUNCTUATION = /\\([!-/:-@[-`{-~])/g;

const unescapePunctuation = (text: string): string => text.replace(ESCAPED_PUNCTUATION, '$1');

const FENCE = /^\s*(```+|~~~+)/;

// Strip stray backslash escapes that the editor adds to Markdown punctuation so
// posts render as authored. The contents of genuine fenced code blocks are left
// untouched (they may contain real backslashes, e.g. a regex `\(` in a sample);
// a block whose fence is itself escaped is not recognised as code, so its body
// is cleaned along with the fence.
export const normalizeMarkdownEscapes = (markdown: string): string => {
	let inFence = false;
	let fenceChar = '';

	return markdown
		.split('\n')
		.map((line) => {
			const fence = line.match(FENCE);

			if (fence) {
				const marker = fence[1][0];
				if (!inFence) {
					inFence = true;
					fenceChar = marker;
					return line;
				}
				if (marker === fenceChar) {
					inFence = false;
					return line;
				}
			}

			return inFence ? line : unescapePunctuation(line);
		})
		.join('\n');
};

export const estimateReadMinutes = (markdown: string): number => {
	const words = markdown.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 220));
};
