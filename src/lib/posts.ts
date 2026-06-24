import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, type NewPost, type Post } from '../db/schema';
import { estimateReadMinutes } from './markdown';

export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface PostInput {
	slug: string;
	title: string;
	description: string;
	bodyMarkdown: string;
	heroImage?: string | null;
	tags?: string[];
	status: PostStatus;
	pubDate: Date;
	authorId?: string | null;
}

export const normalizeSlug = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export const normalizeTags = (value: string | string[] | undefined): string[] => {
	const values = Array.isArray(value) ? value : (value ?? '').split(',');
	return [...new Set(values.map((tag) => tag.trim().replace(/^\+/, '')).filter(Boolean))];
};

const toNewPost = (input: PostInput): NewPost => ({
	slug: normalizeSlug(input.slug),
	title: input.title.trim(),
	description: input.description.trim(),
	bodyMarkdown: input.bodyMarkdown,
	heroImage: input.heroImage?.trim() || null,
	tags: normalizeTags(input.tags),
	status: input.status,
	pubDate: input.pubDate,
	readTimeMinutes: estimateReadMinutes(input.bodyMarkdown),
	authorId: input.authorId ?? null,
	updatedAt: new Date(),
});

export const listPublishedPosts = async (): Promise<Post[]> =>
	db
		.select()
		.from(posts)
		.where(eq(posts.status, 'published'))
		.orderBy(desc(posts.pubDate));

export const getPublishedPostBySlug = async (slug: string): Promise<Post | null> => {
	const [post] = await db
		.select()
		.from(posts)
		.where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
		.limit(1);

	return post ?? null;
};

export const listAllPosts = async (): Promise<Post[]> =>
	db.select().from(posts).orderBy(desc(posts.updatedAt));

export const getPostById = async (id: string): Promise<Post | null> => {
	const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
	return post ?? null;
};

export const createPost = async (input: PostInput): Promise<Post> => {
	const [post] = await db.insert(posts).values(toNewPost(input)).returning();
	return post;
};

export const updatePost = async (id: string, input: PostInput): Promise<Post> => {
	const [post] = await db
		.update(posts)
		.set({
			...toNewPost(input),
			updatedDate: new Date(),
		})
		.where(eq(posts.id, id))
		.returning();

	if (!post) {
		throw new Error('Post not found.');
	}

	return post;
};

export const deletePost = async (id: string): Promise<void> => {
	await db.delete(posts).where(eq(posts.id, id));
};

export const upsertSeedPost = async (input: PostInput): Promise<Post> => {
	const [post] = await db
		.insert(posts)
		.values(toNewPost(input))
		.onConflictDoUpdate({
			target: posts.slug,
			set: {
				title: input.title.trim(),
				description: input.description.trim(),
				bodyMarkdown: input.bodyMarkdown,
				heroImage: input.heroImage?.trim() || null,
				tags: normalizeTags(input.tags),
				status: input.status,
				pubDate: input.pubDate,
				readTimeMinutes: estimateReadMinutes(input.bodyMarkdown),
				updatedAt: new Date(),
			},
		})
		.returning();

	return post;
};
