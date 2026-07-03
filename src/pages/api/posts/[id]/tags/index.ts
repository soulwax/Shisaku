import type { APIRoute } from 'astro';
import {
	apiTagAddSchema,
	apiTagReplaceSchema,
	errorResponse,
	jsonResponse,
	libErrorResponse,
	parseJsonBody,
	unauthorizedResponse,
	validationError,
} from '../../../../../lib/api';
import { authorizeApiRequest } from '../../../../../lib/auth/api';
import { getPostByIdOrSlug, patchPost } from '../../../../../lib/posts';

export const GET: APIRoute = async ({ params, request, locals }) => {
	const { authorized } = await authorizeApiRequest(request, locals.user);
	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post || (post.status !== 'published' && !authorized)) {
		return errorResponse('Post not found.', 404);
	}

	return jsonResponse({ id: post.id, slug: post.slug, tags: post.tags });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
	if (!(await authorizeApiRequest(request, locals.user)).authorized) {
		return unauthorizedResponse();
	}

	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post) {
		return errorResponse('Post not found.', 404);
	}

	const body = await parseJsonBody(request);

	if ('error' in body) {
		return body.error;
	}

	const parsed = apiTagAddSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	const addTags = [...(parsed.data.tag ? [parsed.data.tag] : []), ...(parsed.data.tags ?? [])];

	try {
		const updated = await patchPost(post.id, { addTags });
		return jsonResponse({ id: updated.id, slug: updated.slug, tags: updated.tags });
	} catch (error) {
		return libErrorResponse(error);
	}
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	if (!(await authorizeApiRequest(request, locals.user)).authorized) {
		return unauthorizedResponse();
	}

	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post) {
		return errorResponse('Post not found.', 404);
	}

	const body = await parseJsonBody(request);

	if ('error' in body) {
		return body.error;
	}

	const parsed = apiTagReplaceSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	try {
		const updated = await patchPost(post.id, { tags: parsed.data.tags });
		return jsonResponse({ id: updated.id, slug: updated.slug, tags: updated.tags });
	} catch (error) {
		return libErrorResponse(error);
	}
};
