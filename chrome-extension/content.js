console.log(
  "Job Application Assistant: content script loaded on",
  window.location.href,
);

// --- Design tokens for on-page highlighting ---
// Defined as CSS custom properties on :root, so colors can be changed
// in exactly one place if the visual style needs to evolve later.

const styleTag = document.createElement('style');
styleTag.textContent = `
  :root {
    --jaa-confidence-high: #2e7d32;
    --jaa-confidence-medium: #ed6c02;
    --jaa-confidence-low: #c62828;
    --jaa-outline-width: 2px;
    --jaa-outline-offset: 1px;
  }
`;
document.head.appendChild(styleTag);

// --- Label/context detection helpers ---

function highlightField(input, confidence) {
  const tokenMap = {
    high: 'var(--jaa-confidence-high)',
    medium: 'var(--jaa-confidence-medium)',
    low: 'var(--jaa-confidence-low)',
  };

  const color = tokenMap[confidence] || tokenMap.low;

  input.style.outline = `var(--jaa-outline-width) solid ${color}`;
  input.style.outlineOffset = 'var(--jaa-outline-offset)';
  input.setAttribute('data-jaa-confidence', confidence);
}

function getAssociatedLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();
  }
  const parentLabel = input.closest("label");
  if (parentLabel) return parentLabel.textContent.trim();
  return null;
}

function getNearbyText(input) {
  let container = input.closest("div, fieldset, li") || input.parentElement;
  if (!container) return null;

  let sibling = container.previousElementSibling;
  let attempts = 0;

  while (sibling && attempts < 3) {
    const text = sibling.textContent?.trim();
    if (text && text.length > 0 && text.length < 150) {
      return text;
    }
    sibling = sibling.previousElementSibling;
    attempts++;
  }

  const containerText = container.textContent?.trim();
  if (containerText && containerText.length > 0 && containerText.length < 150) {
    return containerText;
  }

  return null;
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    el.offsetParent !== null
  );
}

const EEO_KEYWORDS = [
  "transgender",
  "race",
  "ethnicity",
  "hispanic",
  "latino",
  "veteran",
  "disability",
  "gender identity",
  "gender",
  "sexual orientation",
];

function isLikelyEeoField(labelText) {
  if (!labelText) return false;
  const lower = labelText.toLowerCase();
  return EEO_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// --- THE SINGLE SHARED FILTER — used for both detection AND filling ---
// This must be the ONLY place this logic is defined, so indexes always match.

function isFillableField(input) {
  return (
    input.type !== "hidden" &&
    input.type !== "submit" &&
    input.type !== "button" &&
    input.type !== "file" &&
    input.getAttribute("aria-hidden") !== "true" &&
    input.tabIndex !== -1 &&
    isVisible(input)
  );
}

// --- Fill helpers ---

function fillNativeSelect(selectEl, value) {
  const options = Array.from(selectEl.options);
  const match = options.find(
    (opt) =>
      opt.textContent.trim().toLowerCase() === value.trim().toLowerCase(),
  );

  if (!match) {
    const partialMatch = options.find((opt) =>
      opt.textContent.trim().toLowerCase().includes(value.trim().toLowerCase()),
    );
    if (!partialMatch) return false;
    selectEl.value = partialMatch.value;
  } else {
    selectEl.value = match.value;
  }

  selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const nativeSetter = descriptor?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function findMatchingOption(value) {
  const ariaOptions = document.querySelectorAll('[role="option"]');
  const ariaMatch = Array.from(ariaOptions).find(
    (el) =>
      isVisible(el) &&
      el.textContent?.trim().toLowerCase().includes(value.trim().toLowerCase()),
  );
  if (ariaMatch) return ariaMatch;

  const fallbackCandidates = document.querySelectorAll(
    'li, [role="listbox"] *, [class*="option" i]',
  );
  const fallbackMatch = Array.from(fallbackCandidates).find(
    (el) =>
      isVisible(el) &&
      el.textContent?.trim().toLowerCase() === value.trim().toLowerCase(),
  );
  return fallbackMatch || null;
}

async function fillInteractiveWidget(input, value) {
  input.focus();
  input.click();

  setNativeValue(input, value);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const match = findMatchingOption(value);

  if (match) {
    match.click();
    return true;
  }

  input.blur();
  return false;
}

async function fillField(input, value) {
  if (input.tagName === "SELECT") {
    return fillNativeSelect(input, value);
  }

  setNativeValue(input, value);

  await new Promise((resolve) => setTimeout(resolve, 150));

  if (input.value === value) {
    return true;
  }

  return await fillInteractiveWidget(input, value);
}

// --- Field scanning — only sends NEWLY discovered fields, to control cost ---

const alreadyRequestedFields = new Set();

function fieldSignature(fieldData) {
  return `${fieldData.id || ""}|${fieldData.name || ""}|${fieldData.associatedLabel || ""}`;
}

function scanAndReportFields() {
  const allInputsOnPage = document.querySelectorAll("input, textarea, select");

  const allFields = Array.from(allInputsOnPage)
    .filter(isFillableField)
    .map((input, index) => {
      const associatedLabel = getAssociatedLabel(input);
      const nearbyText = getNearbyText(input);
      return {
        index,
        tag: input.tagName,
        type: input.type || null,
        name: input.name || null,
        id: input.id || null,
        placeholder: input.placeholder || null,
        ariaLabel: input.getAttribute("aria-label") || null,
        associatedLabel,
        nearbyText,
        isLikelyEeo: isLikelyEeoField(associatedLabel || nearbyText),
      };
    });

  const newFields = allFields.filter(
    (f) => !alreadyRequestedFields.has(fieldSignature(f)),
  );

  if (newFields.length === 0) {
    return; // nothing new — skip entirely, no backend/API call
  }

  newFields.forEach((f) => alreadyRequestedFields.add(fieldSignature(f)));

  console.log(
    `Found ${newFields.length} NEW form field(s), sending to background worker...`,
  );
  console.log("New field details:", newFields);

  chrome.runtime.sendMessage(
    { type: "FIELDS_DETECTED", fields: newFields },
    (response) => {
      console.log("Background worker responded:", response);
    },
  );
}

// Run once immediately, in case the page is already fully rendered
scanAndReportFields();

// --- Watch for dynamically-added content (tabs, multi-step forms, etc.) ---

let debounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    scanAndReportFields();
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// --- Fill listener ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FILL_FIELDS") {
    console.log("Received fill instructions:", message.mappings);

    const allInputsNow = document.querySelectorAll("input, textarea, select");
    const visibleInputs = Array.from(allInputsNow).filter(isFillableField);

    (async () => {
      for (const mapping of message.mappings) {
        const targetInput = visibleInputs[mapping.fieldIndex];
        if (!targetInput) continue;

        if (!mapping.value) {
          // Nothing filled, but still mark it so you know we looked at it
          highlightField(targetInput, 'low');
          continue;
        }

        const success = await fillField(targetInput, mapping.value);
        if (success) {
          highlightField(targetInput, mapping.confidence);
        }
        console.log(
          `Field ${mapping.fieldIndex}: ${success ? "filled" : "FAILED"} with "${mapping.value}"`,
        );
      }
    })();

    sendResponse({ status: "fill_complete" });
  }
  return true;
});
