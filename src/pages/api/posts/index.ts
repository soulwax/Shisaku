import type { APIRoute } from 'astro';
import {
	apiPostCreateSchema,
	errorResponse,
	jsonResponse,
	libErrorResponse,
	parseJsonBody,
	serializePost,
	unauthorizedResponse,
	validationError,
} from '../../../lib/api';
import { authorizeApiRequest } from '../../../lib/auth/api';
import { createPost, listPosts, type ListPostsOptions } from '../../../lib/posts';

const LIST_STATUSES = new Set(['published', 'draft', 'all']);

const parseNonNegativeInt = (value: string | null): number | undefined | null => {
	if (value === null) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
};

export const GET: APIRoute = async ({ request, locals, url }) => {
	const { authorized } = authorizeApiRequest(request, locals.user);
	const status = url.searchParams.get('status') ?? 'published';

	if (!LIST_STATUSES.has(status)) {
		return errorResponse('"status" must be one of: published, draft, all.', 400);
	}

	if (status !== 'published' && !authorized) {
		return unauthorizedResponse();
	}

	const limit = parseNonNegativeInt(url.searchParams.get('limit'));
	const offset = parseNonNegativeInt(url.searchParams.get('offset'));

	if (limit === null || offset === null) {
		return errorResponse('"limit" and "offset" must be non-negative integers.', 400);
	}

	try {
		const found = await listPosts({
			status: status as ListPostsOptions['status'],
			tag: url.searchParams.get('tag') ?? undefined,
			limit,
			offset,
		});

		return jsonResponse({ posts: found.map(serializePost), count: found.length });
	} catch (error) {
		return libErrorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	const auth = authorizeApiRequest(request, locals.user);

	if (!auth.authorized) {
		return unauthorizedResponse();
	}

	const body = await parseJsonBody(request);

	if ('error' in body) {
		return body.error;
	}

	const parsed = apiPostCreateSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	try {
		const post = await createPost({
			title: parsed.data.title,
			slug: parsed.data.slug,
			description: parsed.data.description,
			bodyMarkdown: parsed.data.bodyMarkdown,
			heroImage: parsed.data.heroImage,
			tags: parsed.data.tags,
			status: parsed.data.status,
			pubDate: parsed.data.pubDate ?? new Date(),
			authorId: auth.adminUserId,
		});

		return jsonResponse({ post: serializePost(post) }, 201);
	} catch (error) {
		return libErrorResponse(error);
	}
};
