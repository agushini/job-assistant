import { NextRequest, NextResponse } from 'next/server';
import { db, TEST_USER_ID } from '@/db';
import { profiles, workExperiences, education, certificationsAwards } from '@/db/schema';

export async function POST(req: NextRequest) {
  try {
    const structuredData = await req.json();

    // Step 1: Insert the main profile row, get back its generated ID
    const [newProfile] = await db
      .insert(profiles)
      .values({
        userId: TEST_USER_ID,
        fullName: structuredData.fullName,
        email: structuredData.email,
        phone: structuredData.phone,
        location: structuredData.location,
        summary: structuredData.summary,
        skills: structuredData.skills,
      })
      .returning();

    // Step 2: Insert work experiences, linked to the new profile
    if (structuredData.workExperiences?.length > 0) {
      await db.insert(workExperiences).values(
        structuredData.workExperiences.map((exp: any, index: number) => ({
          profileId: newProfile.id,
          company: exp.company,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          bulletPoints: exp.bulletPoints,
          order: index,
        }))
      );
    }

    // Step 3: Insert education, linked to the new profile
    if (structuredData.education?.length > 0) {
      await db.insert(education).values(
        structuredData.education.map((edu: any) => ({
          profileId: newProfile.id,
          school: edu.school,
          degreeLevel: edu.degreeLevel,
          majors: edu.majors,
          minor: edu.minor,
          startDate: edu.startDate,
          endDate: edu.endDate,
        }))
      );
    }

    // Step 4: Insert certifications/awards, linked to the new profile
    if (structuredData.certificationsAwards?.length > 0) {
      await db.insert(certificationsAwards).values(
        structuredData.certificationsAwards.map((cert: any) => ({
          profileId: newProfile.id,
          title: cert.title,
          issuer: cert.issuer,
          date: cert.date,
          type: cert.type,
        }))
      );
    }

    return NextResponse.json({ success: true, profileId: newProfile.id });
  } catch (error) {
    console.error('Save profile error:', error);
    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}