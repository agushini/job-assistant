chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background worker received message:', message);

  if (message.type === 'FIELDS_DETECTED') {
    fetch('http://localhost:3000/api/map-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: message.fields, url: sender.tab?.url }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Backend responded:', data);

        // Send the mappings back to the content script that requested them
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'FILL_FIELDS',
            mappings: data.mappings ?? [],
          });
        }

        sendResponse({ status: 'success', data });
      })
      .catch((error) => {
        console.error('Backend call failed:', error);
        sendResponse({ status: 'error', error: error.message });
      });

    return true;
  }
});