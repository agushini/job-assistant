// src/app/api/generate-answers/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { db, TEST_USER_ID } from "@/db";
import {
  profiles,
  workExperiences,
  education,
  supplementalQa,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";

const useRealApi = process.env.USE_CLAUDE_API === "true";

export async function POST(req: Request) {
  const { jobDescription, fields } = await req.json();
  // fields: { fieldIndex: number, question: string }[]

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, TEST_USER_ID))
    .orderBy(desc(profiles.createdAt))
    .limit(1);

  if (!profile) {
    return Response.json({ error: "No profile found" }, { status: 404 });
  }

  const [workRows, qaRows] = await Promise.all([
    db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.profileId, profile.id)),
    db
      .select()
      .from(supplementalQa)
      .where(eq(supplementalQa.profileId, profile.id)),
  ]);

  if (!useRealApi) {
    return Response.json({
      answers: fields.map((f: { fieldIndex: number }) => ({
        fieldIndex: f.fieldIndex,
        value: `[MOCK] Generated answer would go here for this question.`,
      })),
    });
  }

  const anthropic = new Anthropic();

  const contextBlock = `
RESUME DATA:
${JSON.stringify({ name: profile.fullName, skills: profile.skills, workExperiences: workRows }, null, 2)}

SUPPLEMENTAL INFO PROVIDED BY THE CANDIDATE (use this heavily — it's their own words about themselves):
${qaRows.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n") || "(none provided)"}

JOB DESCRIPTION:
${jobDescription || "(not captured)"}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: `You are filling out job application screener questions on behalf of a candidate, using their real background. Write in first person, natural human tone — not robotic or resume-speak. Ground every answer in the candidate's actual experience or supplemental answers; never invent specifics that aren't given. Keep answers concise (2-4 sentences unless the question implies more, like a "describe a time..." prompt).`,
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\nQUESTIONS TO ANSWER:\n${fields.map((f: any) => `[${f.fieldIndex}] ${f.question}`).join("\n")}`,
      },
    ],
    tool_choice: { type: "tool", name: "submit_answers" },
    tools: [
      {
        name: "submit_answers",
        description: "Submit generated answers for each screener question",
        input_schema: {
          type: "object",
          properties: {
            answers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fieldIndex: { type: "number" },
                  value: { type: "string" },
                },
                required: ["fieldIndex", "value"],
              },
            },
          },
          required: ["answers"],
        },
      },
    ],
  });

  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  return Response.json(toolUseBlock?.input as { answers: any[] });
}
