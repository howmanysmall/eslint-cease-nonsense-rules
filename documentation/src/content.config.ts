import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const pageBadgeSchema = z
	.object({
		text: z.string(),
		variant: z.enum(["note", "danger", "success", "caution", "tip", "default"]).default("default"),
	})
	.readonly();

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/** Single page badge (shown next to the title). */
				badge: pageBadgeSchema.optional(),
				/** Multiple page badges (shown next to the title). */
				badges: z.array(pageBadgeSchema).optional(),
			}),
		}),
	}),
};
