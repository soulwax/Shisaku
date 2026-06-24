import { ActionError, defineAction } from 'astro:actions';
import { z } from 'zod';
import { isAuthorizedAdminUser } from '../lib/auth/github';
import { deleteSession, SESSION_COOKIE } from '../lib/auth/session';
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
	slug: z.string().min(1).max(180),
	description: z.string().min(1).max(500),
	bodyMarkdown: z.string().min(1),
	heroImage: z.string().optional(),
	tags: z.string().optional(),
	status: z.enum(['draft', 'published']),
	pubDate: z.string().min(1),
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

export const server = {
	posts: {
		save: defineAction({
			accept: 'form',
			input: postInput,
			handler: async (input, context) => {
				const user = requireAdmin(context.locals.user);
				const slug = normalizeSlug(input.slug);

				if (!slug) {
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
