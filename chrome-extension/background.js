// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background worker received message:", message);

  if (message.type === "FIELDS_DETECTED") {
    handleFieldsDetected(message, sender)
      .then((data) => sendResponse({ status: "success", data }))
      .catch((error) => {
        console.error("Field handling failed:", error);
        sendResponse({ status: "error", error: error.message });
      });

    return true; // keep the message channel open for the async response above
  }
});

async function handleFieldsDetected(message, sender) {
  // Step 1: factual mapping + categorization (Gemini/Claude Haiku)
  const mapResponse = await fetch("http://localhost:3000/api/map-fields", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: message.fields,
      jobDescription: message.jobDescription, 
      url: sender.tab?.url,
    }),
  });

  // Check if the response failed and log the HTML/Text error
  if (!mapResponse.ok) {
    const errorText = await mapResponse.text();
    console.error(`map-fields failed with status ${mapResponse.status}:`, errorText.slice(0, 500)); // Log first 500 chars of the HTML
    throw new Error(`Server returned ${mapResponse.status} for map-fields`);
  }

  const mapData = await mapResponse.json();
  console.log("map-fields responded:", mapData);

  let finalMappings = mapData.mappings ?? [];

  // Step 2: find fields flagged as needing a real written answer
  const openEndedMappings = finalMappings.filter(
    (m) => m.fieldCategory === "open_ended",
  );

  if (openEndedMappings.length > 0) {
    const fieldsForGeneration = openEndedMappings.map((m) => {
      const originalField = message.fields.find(
        (f) => f.index === m.fieldIndex,
      );
      return {
        fieldIndex: m.fieldIndex,
        question:
          originalField?.associatedLabel || originalField?.nearbyText || "",
      };
    });

    console.log("Sending to generate-answers:", fieldsForGeneration);

    const genResponse = await fetch(
      "http://localhost:3000/api/generate-answers",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: message.jobDescription,
          fields: fieldsForGeneration,
        }),
      }
    );

    // Check generation response too
    if (!genResponse.ok) {
      const genErrorText = await genResponse.text();
      console.error(`generate-answers failed with status ${genResponse.status}:`, genErrorText.slice(0, 500));
      throw new Error(`Server returned ${genResponse.status} for generate-answers`);
    }

    const genData = await genResponse.json();
    console.log("generate-answers responded:", genData);

    // merge generated answers back into the mapping list, so content.js
    // only ever has to deal with ONE combined array
    finalMappings = finalMappings.map((m) => {
      const generated = genData.answers?.find(
        (a) => a.fieldIndex === m.fieldIndex,
      );
      return generated
        ? { ...m, value: generated.value, confidence: "high" }
        : m;
    });
  }

  // Step 3: single fill message, same as before, just with richer data
  if (sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "FILL_FIELDS",
      mappings: finalMappings,
    });
  }

  return mapData; // still returned for the sendResponse status payload
}