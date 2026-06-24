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
			langs: ['bash', 'css', 'html', 'javascript', 'json', 'markdown', 'rust', 'toml', 'typescript', 'yaml'],
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			defaultColor: false,
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

export const estimateReadMinutes = (markdown: string): number => {
	const words = markdown.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 220));
};
