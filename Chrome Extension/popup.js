// --- CONFIGURATION ---
const LOCAL_API_URL = "http://localhost:8000/optimize";

// --- UI HANDLERS ---
// (Optional) Keep settings toggle if you plan to add other settings later, 
// otherwise you can remove it. For now, we will leave it but hide the key check.

document.getElementById("optimizeBtn").addEventListener("click", async () => {
  setStatus("Reading text...", "black");

  // 1. Get Tab Content
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: getPageInput
  }, async (results) => {
    if (!results || !results[0] || !results[0].result) {
      setStatus("No text found in prompt box.", "red");
      return;
    }

    const originalText = results[0].result;
    setStatus("Optimizing...", "blue");

    // 2. Call Local AI API
    try {
      const optimizedText = await callLLMLinguaAPI(originalText);
      
      // 3. Paste back to page
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: setPageInput,
        args: [optimizedText]
      });
      
      setStatus("Optimized!", "green");
    } catch (error) {
      console.error(error);
      setStatus("Error. Is Server running?", "red");
    }
  });
});

// --- HELPER FUNCTIONS ---

function setStatus(msg, color) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = color || 'black';
}

async function callLLMLinguaAPI(text) {
  const compressionRate = 0.5; // Target 50% of original size

  try {
    const response = await fetch(LOCAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: text,
        rate: compressionRate
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Server connection failed");
    }

    const data = await response.json();
    console.log(`Compressed: ${data.original_tokens} -> ${data.compressed_tokens} tokens (${data.ratio})`);
    
    return data.optimized_prompt;

  } catch (error) {
    console.error("LLMLingua Error:", error);
    throw new Error("Is the Local Server running? " + error.message);
  }
}

// --- CONTENT SCRIPTS ---

function getPageInput() {
  const selectors = ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'];
  for (let s of selectors) {
    const el = document.querySelector(s);
    if (el) return el.value || el.innerText;
  }
  return null;
}

function setPageInput(newText) {
  const selectors = ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'];
  let el = null;
  for (let s of selectors) {
    el = document.querySelector(s);
    if (el) break;
  }
  
  if (el) {
    el.focus();
    if (el.isContentEditable) {
        el.innerText = newText;
    } else {
        el.value = newText;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}