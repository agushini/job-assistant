CREATE TABLE "certifications_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"issuer" text,
	"date" text,
	"type" text
);
--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "degree_level" text;--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "majors" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "minor" text;--> statement-breakpoint
ALTER TABLE "certifications_awards" ADD CONSTRAINT "certifications_awards_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" DROP COLUMN "degree";