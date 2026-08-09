console.log(
  "Job Application Assistant: content script loaded on",
  window.location.href,
);

// --- Label/context detection helpers ---

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

function fillNativeSelect(selectEl, value) {
  const options = Array.from(selectEl.options);
  const match = options.find(
    (opt) => opt.textContent.trim().toLowerCase() === value.trim().toLowerCase(),
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

async function fillCustomDropdown(inputEl, value) {
  inputEl.focus();
  inputEl.click();

  setNativeValue(inputEl, value);

  await new Promise((resolve) => setTimeout(resolve, 400));

  const optionEls = document.querySelectorAll('[class*="option"]');
  const match = Array.from(optionEls).find((el) =>
    el.textContent?.trim().toLowerCase().includes(value.trim().toLowerCase()),
  );

  if (match) {
    match.click();
    return true;
  }

  inputEl.blur();
  return false;
}

// --- Field scanning — runs immediately on page load ---

const allInputsOnLoad = document.querySelectorAll("input, textarea, select");

const fields = Array.from(allInputsOnLoad)
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

console.log(`Found ${fields.length} form field(s), sending to background worker...`);
console.log("Field details:", fields);

chrome.runtime.sendMessage({ type: "FIELDS_DETECTED", fields }, (response) => {
  console.log("Background worker responded:", response);
});

// --- Fill listener ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FILL_FIELDS") {
    console.log("Received fill instructions:", message.mappings);

    const allInputsNow = document.querySelectorAll("input, textarea, select");
    const visibleInputs = Array.from(allInputsNow).filter(isFillableField);

    (async () => {
      for (const mapping of message.mappings) {
        if (!mapping.value) continue;

        const targetInput = visibleInputs[mapping.fieldIndex];
        if (!targetInput) continue;

        if (targetInput.tagName === "SELECT") {
          fillNativeSelect(targetInput, mapping.value);
        } else if (targetInput.getAttribute("role") === "combobox") {
          await fillCustomDropdown(targetInput, mapping.value);
        } else {
          setNativeValue(targetInput, mapping.value);
        }

        console.log(`Filled field ${mapping.fieldIndex} with "${mapping.value}"`);
      }
    })();

    sendResponse({ status: "fill_complete" });
  }
  return true;
});