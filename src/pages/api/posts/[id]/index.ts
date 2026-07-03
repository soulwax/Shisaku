import type { APIRoute } from 'astro';
import {
	apiPostPatchSchema,
	apiPostReplaceSchema,
	errorResponse,
	jsonResponse,
	libErrorResponse,
	parseJsonBody,
	serializePost,
	unauthorizedResponse,
	validationError,
} from '../../../../lib/api';
import { authorizeApiRequest } from '../../../../lib/auth/api';
import { deletePost, getPostByIdOrSlug, patchPost, updatePost } from '../../../../lib/posts';

export const GET: APIRoute = async ({ params, request, locals }) => {
	const { authorized } = await authorizeApiRequest(request, locals.user);
	const post = await getPostByIdOrSlug(params.id ?? '');

	// Drafts 404 for unauthenticated callers so their existence is not leaked.
	if (!post || (post.status !== 'published' && !authorized)) {
		return errorResponse('Post not found.', 404);
	}

	return jsonResponse({ post: serializePost(post) });
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

	const parsed = apiPostReplaceSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	try {
		const updated = await updatePost(post.id, {
			title: parsed.data.title,
			slug: parsed.data.slug,
			description: parsed.data.description,
			bodyMarkdown: parsed.data.bodyMarkdown,
			heroImage: parsed.data.heroImage ?? null,
			tags: parsed.data.tags,
			status: parsed.data.status,
			pubDate: parsed.data.pubDate ?? post.pubDate,
			authorId: post.authorId,
		});

		return jsonResponse({ post: serializePost(updated) });
	} catch (error) {
		return libErrorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
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

	const parsed = apiPostPatchSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	try {
		const updated = await patchPost(post.id, parsed.data);
		return jsonResponse({ post: serializePost(updated) });
	} catch (error) {
		return libErrorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
	if (!(await authorizeApiRequest(request, locals.user)).authorized) {
		return unauthorizedResponse();
	}

	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post) {
		return errorResponse('Post not found.', 404);
	}

	try {
		await deletePost(post.id);
		return jsonResponse({ deleted: true, id: post.id, slug: post.slug });
	} catch (error) {
		return libErrorResponse(error);
	}
};
