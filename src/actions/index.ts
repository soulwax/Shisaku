import { ActionError, defineAction } from 'astro:actions';
import { z } from 'zod';
import { isAuthenticatedGitHubUser, isAuthorizedAdminUser } from '../lib/auth/github';
import { deleteSession, SESSION_COOKIE } from '../lib/auth/session';
import { createComment } from '../lib/comments';
import {
	createPost,
	deletePost,
	normalizeSlug,
	updatePost,
	type PostInput,
} from '../lib/posts';

const postInput = z.object({
	id: z.string().optional(),
	title: z.string().min(1).max(180),
	slug: z.string().max(180).optional(),
	description: z.string().min(1).max(500),
	bodyMarkdown: z.string().min(1),
	heroImage: z.string().optional(),
	tags: z.string().optional(),
	status: z.enum(['draft', 'published']),
	pubDate: z.string().min(1),
});

const commentInput = z.object({
	postId: z.uuid(),
	body: z.string().trim().min(1).max(1000),
});

const requireAdmin = (user: App.Locals['user']) => {
	if (!user || !isAuthorizedAdminUser(user)) {
		throw new ActionError({
			code: 'UNAUTHORIZED',
			message: 'Admin authentication is required.',
		});
	}

	return user;
};

const requireAuthenticatedGitHubUser = (user: App.Locals['user']) => {
	if (!user || !isAuthenticatedGitHubUser(user)) {
		throw new ActionError({
			code: 'UNAUTHORIZED',
			message: 'GitHub sign-in is required.',
		});
	}

	return user;
};

export const server = {
	posts: {
		save: defineAction({
			accept: 'form',
			input: postInput,
			handler: async (input, context) => {
				const user = requireAdmin(context.locals.user);
				const slug = input.slug === undefined ? undefined : normalizeSlug(input.slug);

				if (input.id && !slug) {
					throw new ActionError({
						code: 'BAD_REQUEST',
						message: 'Enter a valid slug.',
					});
				}

				const pubDate = new Date(input.pubDate);

				if (Number.isNaN(pubDate.valueOf())) {
					throw new ActionError({
						code: 'BAD_REQUEST',
						message: 'Enter a valid publication date.',
					});
				}

				const post: PostInput = {
					title: input.title,
					slug,
					description: input.description,
					bodyMarkdown: input.bodyMarkdown,
					heroImage: input.heroImage,
					tags: input.tags?.split(','),
					status: input.status,
					pubDate,
					authorId: user.id,
				};

				const saved = input.id
					? await updatePost(input.id, post)
					: await createPost(post);

				return {
					id: saved.id,
					slug: saved.slug,
					status: saved.status,
				};
			},
		}),
		remove: defineAction({
			accept: 'form',
			input: z.object({
				id: z.uuid(),
			}),
			handler: async (input, context) => {
				requireAdmin(context.locals.user);
				await deletePost(input.id);
				return { deleted: true };
			},
		}),
	},
	comments: {
		create: defineAction({
			accept: 'form',
			input: commentInput,
			handler: async (input, context) => {
				const user = requireAuthenticatedGitHubUser(context.locals.user);
				let comment;

				try {
					comment = await createComment({
						postId: input.postId,
						authorId: user.id,
						authorUsername: user.username,
						body: input.body,
					});
				} catch {
					throw new ActionError({
						code: 'NOT_FOUND',
						message: 'Post not found.',
					});
				}

				return {
					id: comment.id,
				};
			},
		}),
	},
	auth: {
		logout: defineAction({
			accept: 'form',
			handler: async (_input, context) => {
				const token = context.cookies.get(SESSION_COOKIE)?.value;

				if (token) {
					await deleteSession(token);
				}

				context.cookies.delete(SESSION_COOKIE, { path: '/' });
				return { loggedOut: true };
			},
		}),
	},
};
