import { z } from 'zod';
import type { Post } from '../db/schema';

export const jsonResponse = (data: unknown, status = 200): Response =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});

export const errorResponse = (
	message: string,
	status: number,
	details?: Array<{ path: string; message: string }>,
): Response => jsonResponse(details ? { error: message, details } : { error: message }, status);

export const unauthorizedResponse = (): Response =>
	errorResponse(
		'Authentication required. Send "Authorization: Bearer <BLOG_API_TOKEN>" or sign in as the admin.',
		401,
	);

export const validationError = (error: z.ZodError): Response =>
	errorResponse(
		'Validation failed.',
		400,
		error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
	);

const LIB_BAD_REQUEST_MESSAGES = new Set(['Enter a valid slug.', 'Unable to generate a unique slug.']);

/**
 * Maps errors thrown by src/lib/posts.ts to HTTP responses. Anything
 * unrecognized becomes a JSON 500 so API clients never receive an HTML
 * error page.
 */
export const libErrorResponse = (error: unknown): Response => {
	if (error instanceof Error) {
		if (error.message === 'Post not found.') {
			return errorResponse('Post not found.', 404);
		}

		if (LIB_BAD_REQUEST_MESSAGES.has(error.message)) {
			return errorResponse(error.message, 400);
		}
	}

	console.error('Unhandled API error:', error);
	return errorResponse('Internal server error.', 500);
};

export type ParsedJsonBody = { data: unknown } | { error: Response };

export const parseJsonBody = async (request: Request): Promise<ParsedJsonBody> => {
	try {
		return { data: await request.json() };
	} catch {
		return { error: errorResponse('Request body must be valid JSON.', 400) };
	}
};

const title = z.string().trim().min(1).max(180);
const description = z.string().trim().min(1).max(500);
const bodyMarkdown = z.string().min(1);
const slug = z.string().trim().min(1).max(180);
const heroImage = z.string().trim().max(2048);
const status = z.enum(['draft', 'published']);
const pubDate = z.coerce.date();
const tagList = z.array(z.string().trim().min(1).max(64)).max(64);

export const apiPostCreateSchema = z.object({
	title,
	description,
	bodyMarkdown,
	slug: slug.optional(),
	heroImage: heroImage.nullish(),
	tags: tagList.optional(),
	status: status.default('draft'),
	pubDate: pubDate.optional(),
});

/**
 * PUT is a full replace: omitted `heroImage` clears it and omitted `tags`
 * clears the tag list. `slug` and `pubDate` are the exceptions — omitting
 * them keeps the current values, since regenerating either as a side effect
 * of a routine replace would break URLs and feed ordering.
 */
export const apiPostReplaceSchema = z.object({
	title,
	description,
	bodyMarkdown,
	status,
	slug: slug.optional(),
	heroImage: heroImage.nullish(),
	tags: tagList.default([]),
	pubDate: pubDate.optional(),
});

export const apiPostPatchSchema = z
	.object({
		title: title.optional(),
		description: description.optional(),
		bodyMarkdown: bodyMarkdown.optional(),
		slug: slug.optional(),
		heroImage: heroImage.nullable().optional(),
		tags: tagList.optional(),
		addTags: tagList.optional(),
		removeTags: tagList.optional(),
		status: status.optional(),
		pubDate: pubDate.optional(),
	})
	.refine((value) => Object.values(value).some((field) => field !== undefined), {
		message: 'Provide at least one field to update.',
	})
	.refine((value) => value.tags === undefined || (value.addTags === undefined && value.removeTags === undefined), {
		message: '"tags" replaces the whole list and cannot be combined with "addTags" or "removeTags".',
		path: ['tags'],
	});

export const apiTagAddSchema = z
	.object({
		tag: z.string().trim().min(1).max(64).optional(),
		tags: tagList.optional(),
	})
	.refine((value) => value.tag !== undefined || (value.tags !== undefined && value.tags.length > 0), {
		message: 'Provide "tag" (string) or a non-empty "tags" (array).',
	});

export const apiTagReplaceSchema = z.object({
	tags: tagList,
});

export interface SerializedPost {
	id: string;
	slug: string;
	title: string;
	description: string;
	bodyMarkdown: string;
	heroImage: string | null;
	tags: string[];
	status: string;
	pubDate: string;
	updatedDate: string | null;
	readTimeMinutes: number;
	authorId: string | null;
	createdAt: string;
	updatedAt: string;
	url: string;
}

export const serializePost = (post: Post): SerializedPost => ({
	id: post.id,
	slug: post.slug,
	title: post.title,
	description: post.description,
	bodyMarkdown: post.bodyMarkdown,
	heroImage: post.heroImage,
	tags: post.tags,
	status: post.status,
	pubDate: post.pubDate.toISOString(),
	updatedDate: post.updatedDate?.toISOString() ?? null,
	readTimeMinutes: post.readTimeMinutes,
	authorId: post.authorId,
	createdAt: post.createdAt.toISOString(),
	updatedAt: post.updatedAt.toISOString(),
	url: `/blog/${post.slug}/`,
});
