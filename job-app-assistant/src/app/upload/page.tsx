'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [structuredData, setStructuredData] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('Uploading...');
    setStructuredData(null);
    setSaveStatus('');

    const formData = new FormData();
    formData.append('resume', file);

    const res = await fetch('/api/parse-resume', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setStatus(JSON.stringify(data, null, 2));

    if (data.structuredData) {
      setStructuredData(data.structuredData);
    }
  };

  const handleSave = async () => {
    if (!structuredData) return;

    setSaveStatus('Saving...');

    const res = await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structuredData),
    });

    const data = await res.json();

    if (data.success) {
      setSaveStatus(`Saved! Profile ID: ${data.profileId}`);
    } else {
      setSaveStatus(`Error: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Upload Resume</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" style={{ marginLeft: '1rem' }}>
          Upload
        </button>
      </form>

      <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{status}</pre>

      {structuredData && (
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleSave}>Save to Profile</button>
          {saveStatus && <p>{saveStatus}</p>}
        </div>
      )}
    </div>
  );
}