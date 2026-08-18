"use client";

import { useState, useEffect } from "react";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [skillsText, setSkillsText] = useState("");
  const [workExperiences, setWorkExperiences] = useState<any[]>([]);
  const [educationList, setEducationList] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [supplementalQa, setSupplementalQA] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus(data.error);
          return;
        }
        setProfile(data.profile);
        setSkillsText((data.profile.skills ?? []).join(", "));
        setWorkExperiences(data.workExperiences);
        setEducationList(data.education);
        setCerts(data.certificationsAwards);
        setSupplementalQA(data.supplementalQa);
      });
  }, []);

  const handleSave = async () => {
    setStatus("Saving...");
    const skillsArray = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { ...profile, skills: skillsArray },
        workExperiences,
        education: educationList,
        certificationsAwards: certs,
        supplementalQa: supplementalQa,
      }),
    });
    const data = await res.json();
    setStatus(data.success ? "Saved!" : `Error: ${data.error}`);
  };

  if (!profile)
    return <div className={styles.page}>{status || "Loading..."}</div>;

  return (
    <div className={styles.page}>
      <h1>Edit Profile</h1>

      {/* Basic Info */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Info</h2>

        <div className={styles.formGroup}>
          <label className={styles.label}>Full Name</label>
          <input
            className={styles.input}
            value={profile.fullName ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, fullName: e.target.value })
            }
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            value={profile.email ?? ""}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Phone</label>
          <input
            className={styles.input}
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Location</label>
          <input
            className={styles.input}
            value={profile.location ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, location: e.target.value })
            }
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Skills (comma-separated)</label>
          <textarea
            className={styles.textarea}
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
          />
        </div>
      </div>

      {/* Work Experience */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Work Experience</h2>
        {workExperiences.map((exp, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Company</label>
              <input
                className={styles.input}
                value={exp.company ?? ""}
                onChange={(e) => {
                  const updated = [...workExperiences];
                  updated[i] = { ...exp, company: e.target.value };
                  setWorkExperiences(updated);
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title</label>
              <input
                className={styles.input}
                value={exp.title ?? ""}
                onChange={(e) => {
                  const updated = [...workExperiences];
                  updated[i] = { ...exp, title: e.target.value };
                  setWorkExperiences(updated);
                }}
              />
            </div>
            <div className={styles.cardRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Start Date</label>
                <input
                  className={styles.input}
                  value={exp.startDate ?? ""}
                  onChange={(e) => {
                    const updated = [...workExperiences];
                    updated[i] = { ...exp, startDate: e.target.value };
                    setWorkExperiences(updated);
                  }}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>End Date</label>
                <input
                  className={styles.input}
                  value={exp.endDate ?? ""}
                  onChange={(e) => {
                    const updated = [...workExperiences];
                    updated[i] = { ...exp, endDate: e.target.value };
                    setWorkExperiences(updated);
                  }}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Bullet Points (one per line)
              </label>
              <textarea
                className={styles.textarea}
                value={(exp.bulletPoints ?? []).join("\n")}
                onChange={(e) => {
                  const updated = [...workExperiences];
                  updated[i] = {
                    ...exp,
                    bulletPoints: e.target.value.split("\n"),
                  };
                  setWorkExperiences(updated);
                }}
              />
            </div>
            <button
              className={styles.removeButton}
              onClick={() =>
                setWorkExperiences(
                  workExperiences.filter((_, idx) => idx !== i),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() =>
            setWorkExperiences([
              ...workExperiences,
              {
                company: "",
                title: "",
                startDate: "",
                endDate: "",
                bulletPoints: [],
              },
            ])
          }
        >
          + Add Work Experience
        </button>
      </div>

      {/* Education */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Education</h2>
        {educationList.map((edu, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.formGroup}>
              <label className={styles.label}>School</label>
              <input
                className={styles.input}
                value={edu.school ?? ""}
                onChange={(e) => {
                  const updated = [...educationList];
                  updated[i] = { ...edu, school: e.target.value };
                  setEducationList(updated);
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Degree Level</label>
              <input
                className={styles.input}
                value={edu.degreeLevel ?? ""}
                placeholder="e.g. Bachelor's"
                onChange={(e) => {
                  const updated = [...educationList];
                  updated[i] = { ...edu, degreeLevel: e.target.value };
                  setEducationList(updated);
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Majors (comma-separated)</label>
              <input
                className={styles.input}
                value={(edu.majors ?? []).join(", ")}
                onChange={(e) => {
                  const updated = [...educationList];
                  updated[i] = {
                    ...edu,
                    majors: e.target.value.split(",").map((m) => m.trim()),
                  };
                  setEducationList(updated);
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Minor</label>
              <input
                className={styles.input}
                value={edu.minor ?? ""}
                onChange={(e) => {
                  const updated = [...educationList];
                  updated[i] = { ...edu, minor: e.target.value };
                  setEducationList(updated);
                }}
              />
            </div>
            <div className={styles.cardRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Start Date</label>
                <input
                  className={styles.input}
                  value={edu.startDate ?? ""}
                  onChange={(e) => {
                    const updated = [...educationList];
                    updated[i] = { ...edu, startDate: e.target.value };
                    setEducationList(updated);
                  }}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>End Date</label>
                <input
                  className={styles.input}
                  value={edu.endDate ?? ""}
                  onChange={(e) => {
                    const updated = [...educationList];
                    updated[i] = { ...edu, endDate: e.target.value };
                    setEducationList(updated);
                  }}
                />
              </div>
            </div>
            <button
              className={styles.removeButton}
              onClick={() =>
                setEducationList(educationList.filter((_, idx) => idx !== i))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() =>
            setEducationList([
              ...educationList,
              {
                school: "",
                degreeLevel: "",
                majors: [],
                minor: "",
                startDate: "",
                endDate: "",
              },
            ])
          }
        >
          + Add Education
        </button>
      </div>

      {/* Certifications & Awards */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Certifications & Awards</h2>
        {certs.map((cert, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title</label>
              <input
                className={styles.input}
                value={cert.title ?? ""}
                onChange={(e) => {
                  const updated = [...certs];
                  updated[i] = { ...cert, title: e.target.value };
                  setCerts(updated);
                }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Issuer</label>
              <input
                className={styles.input}
                value={cert.issuer ?? ""}
                onChange={(e) => {
                  const updated = [...certs];
                  updated[i] = { ...cert, issuer: e.target.value };
                  setCerts(updated);
                }}
              />
            </div>
            <div className={styles.cardRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Date</label>
                <input
                  className={styles.input}
                  value={cert.date ?? ""}
                  onChange={(e) => {
                    const updated = [...certs];
                    updated[i] = { ...cert, date: e.target.value };
                    setCerts(updated);
                  }}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Type</label>
                <input
                  className={styles.input}
                  value={cert.type ?? ""}
                  placeholder="certification or award"
                  onChange={(e) => {
                    const updated = [...certs];
                    updated[i] = { ...cert, type: e.target.value };
                    setCerts(updated);
                  }}
                />
              </div>
            </div>
            <button
              className={styles.removeButton}
              onClick={() => setCerts(certs.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() =>
            setCerts([...certs, { title: "", issuer: "", date: "", type: "" }])
          }
        >
          + Add Certification/Award
        </button>
      </div>

      {/* Supplemental Questions and Information */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}> Supplemental QA </h2>
        {supplementalQa.map((supplementalQaRow, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.formGroup}>
              <label className={styles.label}> Question</label>
              <input
                className={styles.input}
                value={supplementalQaRow.question ?? ""}
                onChange={(e) => {
                  const updated = [...supplementalQa];
                  updated[i] = {
                    ...supplementalQaRow,
                    question: e.target.value,
                  };
                  setSupplementalQA(updated);
                }}
              />
            </div>

            <div className={styles.cardRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}> Answer </label>
                <textarea
                  className={styles.input}
                  value={supplementalQaRow.answer ?? ""}
                  onChange={(e) => {
                    const updated = [...supplementalQa];
                    updated[i] = {
                      ...supplementalQaRow,
                      answer: e.target.value,
                    };
                    setSupplementalQA(updated);
                  }}
                />
              </div>
            </div>
            <button
              className={styles.removeButton}
              onClick={() =>
                setSupplementalQA(supplementalQa.filter((_, idx) => idx !== i))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className={styles.addButton}
          onClick={() =>
            setSupplementalQA([...supplementalQa, { question: "", answer: "" }])
          }
        >
          + Add Supplemental Info
        </button>
      </div>

      <div className={styles.section}>
        <button className={styles.saveButton} onClick={handleSave}>
          Save Changes
        </button>
        {status && <p className={styles.status}>{status}</p>}
      </div>
    </div>
  );
}
