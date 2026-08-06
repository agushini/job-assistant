"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch("/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setStatus(JSON.stringify(data, null, 2));
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Upload Resume</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" style={{ marginLeft: "1rem" }}>
          Upload
        </button>
      </form>
      <pre style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>{status}</pre>
    </div>
  );
}
