import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, type NewPost, type Post } from '../db/schema';
import { estimateReadMinutes } from './markdown';
export { normalizeSlug } from './slugs';
import { normalizeSlug } from './slugs';

export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
const MAX_SLUG_LENGTH = 180;

export interface PostInput {
	slug?: string;
	title: string;
	description: string;
	bodyMarkdown: string;
	heroImage?: string | null;
	tags?: string[];
	status: PostStatus;
	pubDate: Date;
	authorId?: string | null;
}

const trimSlug = (value: string, maxLength = MAX_SLUG_LENGTH): string =>
	value.slice(0, maxLength).replace(/-+$/g, '');

const slugBaseFromTitle = (title: string): string => trimSlug(normalizeSlug(title)) || 'post';

const slugCandidate = (base: string, index: number): string => {
	if (index === 1) {
		return trimSlug(base);
	}

	const suffix = `-${index}`;
	return `${trimSlug(base, MAX_SLUG_LENGTH - suffix.length)}${suffix}`;
};

const getPostIdBySlug = async (slug: string): Promise<string | null> => {
	const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
	return post?.id ?? null;
};

const getAvailableSlug = async (base: string, exceptId?: string): Promise<string> => {
	for (let index = 1; index < 1000; index += 1) {
		const candidate = slugCandidate(base, index);
		const existingId = await getPostIdBySlug(candidate);

		if (!existingId || existingId === exceptId) {
			return candidate;
		}
	}

	throw new Error('Unable to generate a unique slug.');
};

export const normalizeTags = (value: string | string[] | undefined): string[] => {
	const values = Array.isArray(value) ? value : (value ?? '').split(',');
	return [...new Set(values.map((tag) => tag.trim().replace(/^\+/, '')).filter(Boolean))];
};

const toNewPost = (input: PostInput, slug: string): NewPost => ({
	slug,
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
	const slug = await getAvailableSlug(slugBaseFromTitle(input.title));
	const [post] = await db.insert(posts).values(toNewPost(input, slug)).returning();
	return post;
};

export const updatePost = async (id: string, input: PostInput): Promise<Post> => {
	const current = await getPostById(id);

	if (!current) {
		throw new Error('Post not found.');
	}

	const requestedSlug = input.slug === undefined ? current.slug : normalizeSlug(input.slug);

	if (!requestedSlug) {
		throw new Error('Enter a valid slug.');
	}

	const slug =
		input.slug === undefined ? current.slug : await getAvailableSlug(trimSlug(requestedSlug), id);
	const [post] = await db
		.update(posts)
		.set({
			...toNewPost(input, slug),
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
	if (!input.slug) {
		throw new Error('Seed posts require a slug.');
	}

	const slug = normalizeSlug(input.slug);

	if (!slug) {
		throw new Error('Seed posts require a valid slug.');
	}

	const [post] = await db
		.insert(posts)
		.values(toNewPost(input, slug))
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
