import { NextResponse } from 'next/server';
import { db, TEST_USER_ID } from '@/db';
import { profiles, workExperiences, education, certificationsAwards } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, TEST_USER_ID))
      .orderBy(desc(profiles.createdAt))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 });
    }

    const workExp = await db
      .select()
      .from(workExperiences)
      .where(eq(workExperiences.profileId, profile.id));

    const edu = await db
      .select()
      .from(education)
      .where(eq(education.profileId, profile.id));

    const certs = await db
      .select()
      .from(certificationsAwards)
      .where(eq(certificationsAwards.profileId, profile.id));

    return NextResponse.json({
      profile,
      workExperiences: workExp,
      education: edu,
      certificationsAwards: certs,
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { profile, workExperiences: workExp, education: edu, certificationsAwards: certs } = body;

    // Update the main profile fields
    await db
      .update(profiles)
      .set({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
        skills: profile.skills,
      })
      .where(eq(profiles.id, profile.id));

    // For related tables, simplest approach for now: delete all existing rows, re-insert current state.
    // This correctly handles adds/removes/edits without needing to track individual row changes.
    await db.delete(workExperiences).where(eq(workExperiences.profileId, profile.id));
    await db.delete(education).where(eq(education.profileId, profile.id));
    await db.delete(certificationsAwards).where(eq(certificationsAwards.profileId, profile.id));

    if (workExp.length > 0) {
      await db.insert(workExperiences).values(
        workExp.map((exp: any, index: number) => ({
          profileId: profile.id,
          company: exp.company,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          bulletPoints: exp.bulletPoints,
          order: index,
        }))
      );
    }

    if (edu.length > 0) {
      await db.insert(education).values(
        edu.map((e: any) => ({
          profileId: profile.id,
          school: e.school,
          degreeLevel: e.degreeLevel,
          majors: e.majors,
          minor: e.minor,
          startDate: e.startDate,
          endDate: e.endDate,
        }))
      );
    }

    if (certs.length > 0) {
      await db.insert(certificationsAwards).values(
        certs.map((c: any) => ({
          profileId: profile.id,
          title: c.title,
          issuer: c.issuer,
          date: c.date,
          type: c.type,
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}