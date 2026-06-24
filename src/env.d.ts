/// <reference types="astro/client" />

import type { User } from './db/schema';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
}

export {};
