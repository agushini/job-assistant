import { NextRequest, NextResponse } from "next/server";
import { db, TEST_USER_ID } from "@/db";
import { profiles, workExperiences, education } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const mappingSchema = {
  name: "map_fields",
  description: "Map form fields to profile data values",
  input_schema: {
    type: "object" as const,
    properties: {
      mappings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fieldIndex: {
              type: "number",
              description: "The index of the field being mapped",
            },
            value: {
              type: "string",
              description:
                "The value to fill into this field, or empty string if no confident match exists",
            },
            confidence: {
              type: "string",
              description:
                '"high", "medium", or "low" — how confident this mapping is',
            },
          },
          required: ["fieldIndex", "value", "confidence"],
        },
      },
    },
    required: ["mappings"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fields = body.fields ?? [];

    // Skip EEO fields entirely for this mapping pass — handled separately later
    const fillableFields = fields.filter((f: any) => !f.isLikelyEeo);

    // Fetch the saved profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, TEST_USER_ID))
      .orderBy(desc(profiles.createdAt))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "No profile found" }, { status: 404 });
    }

    const workExp = await db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.profileId, profile.id));

    const edu = await db
      .select()
      .from(education)
      .where(eq(education.profileId, profile.id));

    const useRealApi = process.env.USE_CLAUDE_API === "true";

   if (!useRealApi) {
  const mockMappings = fillableFields.map((f: any) => {
    const label = (f.associatedLabel || f.nearbyText || f.placeholder || f.id || '').toLowerCase();

    let value = '';
    let confidence = 'low';

    if (label.includes('first name')) {
      value = 'Jordan';
      confidence = 'high';
    } else if (label.includes('last name')) {
      value = 'Rivera';
      confidence = 'high';
    } else if (label.includes('preferred name')) {
      value = 'Jordan';
      confidence = 'high';
    } else if (label.includes('email')) {
      value = 'jordan.rivera@example.com';
      confidence = 'high';
    } else if (label.includes('phone')) {
      value = '555-0182';
      confidence = 'high';
    } else if (label.includes('location') || label.includes('city')) {
      value = 'Austin, TX';
      confidence = 'high';
    } else if (label.includes('country')) {
      value = 'United States';
      confidence = 'medium';
    } else if (label.includes('school') || label.includes('university')) {
      value = 'Sample State University';
      confidence = 'high';
    } else if (label.includes('degree')) {
      value = "Bachelor's";
      confidence = 'high';
    } else if (label.includes('discipline') || label.includes('major')) {
      value = 'Computer Science';
      confidence = 'high';
    } else if (label.includes('start-month')) {
      value = 'August';
      confidence = 'high';
    } else if (label.includes('start-year')) {
      value = '2018';
      confidence = 'high';
    } else if (label.includes('end-month')) {
      value = 'May';
      confidence = 'high';
    } else if (label.includes('end-year')) {
      value = '2022';
      confidence = 'high';
    } else if (f.tag === 'SELECT' || f.tag === 'INPUT') {
      // Leave unmatched fields (free-text questions, unknowns) empty, as real mapping would
      value = '';
      confidence = 'low';
    }

    return {
      fieldIndex: f.index,
      value,
      confidence,
    };
  });
  return NextResponse.json({ mappings: mockMappings, mock: true });
}

    const profileContext = {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      skills: profile.skills,
      workExperiences: workExp,
      education: edu,
    };

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      tools: [mappingSchema],
      tool_choice: { type: "tool", name: "map_fields" },
      messages: [
        {
          role: "user",
          content: `Here is a candidate's profile data:\n${JSON.stringify(profileContext, null, 2)}\n\nHere are form fields detected on a job application page:\n${JSON.stringify(fillableFields, null, 2)}\n\nFor each field, determine what profile value (if any) should fill it. Use the field's associatedLabel first, falling back to nearbyText, placeholder, or name/id if needed.\n\nOnly return a high or medium confidence value for fields asking for objective facts directly present in the profile data (name, contact info, dates, schools, job titles, etc.).\n\nFor fields asking the candidate to rate themselves, share an opinion, self-assess a skill level, or answer any subjective question — even if you could infer a plausible answer from the profile — always return an empty string with "low" confidence. These require the candidate's own judgment, not an inferred guess.\n\nFor open-ended free-text questions (e.g. "why do you want to work here," "describe a time when...") always return an empty string with "low" confidence — these will be handled separately.`,
        },
      ],
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use",
    );
    const result = (
      toolUseBlock && "input" in toolUseBlock
        ? toolUseBlock.input
        : { mappings: [] }
    ) as { mappings: any[] };

    return NextResponse.json({ ...result, mock: false });
  } catch (error) {
    console.error("Map-fields error:", error);
    return NextResponse.json(
      { error: "Failed to map fields" },
      { status: 500 },
    );
  }
}
