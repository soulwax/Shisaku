import type { APIRoute } from 'astro';
import {
	errorResponse,
	jsonResponse,
	libErrorResponse,
	unauthorizedResponse,
} from '../../../../../lib/api';
import { authorizeApiRequest } from '../../../../../lib/auth/api';
import { getPostByIdOrSlug, patchPost } from '../../../../../lib/posts';

const MAX_TAG_LENGTH = 64;

const validTagParam = (tag: string | undefined): string | null => {
	const trimmed = tag?.trim() ?? '';
	return trimmed.length > 0 && trimmed.length <= MAX_TAG_LENGTH ? trimmed : null;
};

/** Adds a single tag. Idempotent: adding an existing tag is a no-op success. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
	if (!authorizeApiRequest(request, locals.user).authorized) {
		return unauthorizedResponse();
	}

	const tag = validTagParam(params.tag);

	if (!tag) {
		return errorResponse(`Tag must be 1-${MAX_TAG_LENGTH} characters.`, 400);
	}

	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post) {
		return errorResponse('Post not found.', 404);
	}

	try {
		const updated = await patchPost(post.id, { addTags: [tag] });
		return jsonResponse({ id: updated.id, slug: updated.slug, tags: updated.tags });
	} catch (error) {
		return libErrorResponse(error);
	}
};

/** Removes a single tag (case-insensitive). Idempotent: removing an absent tag succeeds. */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
	if (!authorizeApiRequest(request, locals.user).authorized) {
		return unauthorizedResponse();
	}

	const tag = validTagParam(params.tag);

	if (!tag) {
		return errorResponse(`Tag must be 1-${MAX_TAG_LENGTH} characters.`, 400);
	}

	const post = await getPostByIdOrSlug(params.id ?? '');

	if (!post) {
		return errorResponse('Post not found.', 404);
	}

	try {
		const updated = await patchPost(post.id, { removeTags: [tag] });
		return jsonResponse({ id: updated.id, slug: updated.slug, tags: updated.tags });
	} catch (error) {
		return libErrorResponse(error);
	}
};
