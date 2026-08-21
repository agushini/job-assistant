import { NextRequest, NextResponse } from "next/server";
import { db, TEST_USER_ID } from "@/db";
import {
  profiles,
  workExperiences,
  education,
  supplementalQa,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const googleGenAi = new GoogleGenAI({
  apiKey: process.env.GOOGLEGENAI_API_KEY,
});

// Standard JSON Schema (Lowercase types for standard compatibility)
const mappingParameters = {
  type: "object",
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
          fieldCategory: {
            type: "string",
            enum: ["factual", "subjective_rating", "open_ended", "eeo"],
            description:
              'factual = objective lookup (name, dates, schools). subjective_rating = self-assessment scale (e.g. "rate your familiarity 1-5"). open_ended = free-text question needing a real written answer (e.g. "why do you want to work here"). eeo = demographic self-ID field.',
          },
        },
        required: ["fieldIndex", "value", "confidence", "fieldCategory"],
      },
    },
  },
  required: ["mappings"],
};

// Claude schema adapter
const anthropicMappingSchema: Anthropic.Tool = {
  name: "map_fields",
  description: "Map form fields to profile data values",
  input_schema: mappingParameters as Anthropic.Tool.InputSchema,
};

// Gemini schema adapter
const geminiMappingSchema = {
  name: "map_fields",
  description: "Map form fields to profile data values",
  parameters: mappingParameters,
};

const buildMappingPrompt = (profileContext: any, fillableFields: any) => `
Here is a candidate's profile data:
${JSON.stringify(profileContext, null, 2)}

Here are form fields detected on a job application page:
${JSON.stringify(fillableFields, null, 2)}

For each field, determine what profile value (if any) should fill it. Use the field's associatedLabel first, 
falling back to nearbyText, placeholder, or name/id if needed. 
For open-ended free-text questions (e.g. "why do you want to work here," "describe a time when...") always return an empty string with "low" 
confidence — these will be handled separately.
If a field includes an "options" array, you MUST return a value that exactly matches one of the given strings (or empty 
string if none genuinely apply). Categorize these fields as "factual", never "open_ended" — 
selecting among a fixed list is a lookup task, not free writing.

For fields categorized "subjective_rating" (self-assessment/rating-scale questions):
- If the field includes an "options" array, you MUST select one of those exact option strings — never write free text.
- Ground your choice in the candidate's actual resume data (skills, work experience descriptions) and supplemental Q&A answers. 
  Look for concrete evidence: specific tools mentioned, described usage patterns, years of experience. Do not make up any experience.
  Only infer from the canidates data. 
- Match evidence to the option whose described criteria the evidence actually supports. Do not default to the highest or lowest 
  option — read each option's parenthetical description carefully and pick the one that fits.
- Confidence should be "medium" when evidence reasonably supports a choice (this is inherently an inference, never "high").
- Only return empty value + "low" confidence if there is truly no relevant evidence anywhere in the resume or supplemental 
  answers to base a choice on — not just because the question is subjective in nature.
`;

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

    const supplementalQaRows = await db
      .select()
      .from(supplementalQa)
      .where(eq(supplementalQa.profileId, profile.id));

    // Refactored to act as a master switch for ALL LLM calls
    const useRealApi = process.env.USE_LLM_API === "true";

    if (!useRealApi) {
      const mockMappings = fillableFields.map((f: any) => {
        const label = (
          f.associatedLabel ||
          f.nearbyText ||
          f.placeholder ||
          f.id ||
          f.fieldCategory ||
          ""
        ).toLowerCase();

        let value = "";
        let confidence = "low";
        let fieldCategory = "factual";

        if (label.includes("first name")) {
          value = "Jordan";
          confidence = "high";
        } else if (label.includes("last name")) {
          value = "Rivera";
          confidence = "high";
        } else if (label.includes("preferred name")) {
          value = "Jordan";
          confidence = "high";
        } else if (label.includes("email")) {
          value = "jordan.rivera@example.com";
          confidence = "high";
        } else if (label.includes("phone")) {
          value = "555-0182";
          confidence = "high";
        } else if (label.includes("location") || label.includes("city")) {
          value = "Austin, TX";
          confidence = "high";
        } else if (label.includes("country")) {
          value = "United States";
          confidence = "medium";
        } else if (label.includes("school") || label.includes("university")) {
          value = "Sample State University";
          confidence = "high";
        } else if (label.includes("degree")) {
          value = "Bachelor's";
          confidence = "high";
        } else if (label.includes("discipline") || label.includes("major")) {
          value = "Computer Science";
          confidence = "high";
        } else if (label.includes("start-month")) {
          value = "August";
          confidence = "high";
        } else if (label.includes("start-year")) {
          value = "2018";
          confidence = "high";
        } else if (label.includes("end-month")) {
          value = "May";
          confidence = "high";
        } else if (label.includes("end-year")) {
          value = "2022";
          confidence = "high";
        } else if (f.tag === "SELECT" || f.tag === "INPUT") {
          // Leave unmatched fields (free-text questions, unknowns) empty, as real mapping would
          value = "";
          confidence = "low";
        }

        return {
          fieldIndex: f.index,
          value,
          confidence,
          fieldCategory,
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
      supplementalQa: supplementalQaRows,
    };

    const promptText = buildMappingPrompt(profileContext, fillableFields);

    let result: { mappings: any[] } | null = null;
    let providerUsed = "gemini";

    // --- 1. Primary Attempt: Google Gemini ---
    try {
      const messageGemini = await googleGenAi.models.generateContent({
        model: "gemini-3.6-flash",
        contents: promptText,
        config: {
          maxOutputTokens: 4000,
          // Use 'any' cast to bypass strict SDK internal enum requirements
          tools: [{ functionDeclarations: [geminiMappingSchema as any] }],
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY" as any, // Cast to any to satisfy TS Enum requirement
              allowedFunctionNames: ["map_fields"],
            },
          },
        },
      });

      const functionCall = messageGemini.functionCalls?.[0];
      if (functionCall?.args) {
        // Cast as unknown first to satisfy TS object casting rules
        result = functionCall.args as unknown as { mappings: any[] };
      } else {
        throw new Error("Gemini did not return valid function arguments.");
      }
    } catch (geminiError) {
      console.warn("Gemini call failed or out of credits, falling back to Claude:", geminiError);

      // --- 2. Fallback Attempt: Anthropic Claude ---
      providerUsed = "claude";
      const messageAnthropic = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        tools: [anthropicMappingSchema],
        tool_choice: { type: "tool", name: "map_fields" },
        messages: [{ role: "user", content: promptText }],
      });

      // Use a type predicate to narrow block to ToolUseBlock
      const toolUseBlock = messageAnthropic.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlock) {
        result = toolUseBlock.input as unknown as { mappings: any[] };
      } else {
        result = { mappings: [] };
      }
    }

    return NextResponse.json({ ...result, provider: providerUsed, mock: false });
  } catch (error) {
    console.error("Map-fields error:", error);
    return NextResponse.json(
      { error: "Failed to map fields" },
      { status: 500 }
    );
  }
}