// --- CONFIGURATION ---
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_ID = "llama-3.3-70b-versatile"; // Extremely fast and good at summarization

// --- UI HANDLERS ---
document.getElementById('toggleSettings').addEventListener('click', () => {
  const el = document.getElementById('settings');
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    chrome.storage.sync.set({ llmbda_api_key: key }, () => {
      setStatus("Key saved!", "green");
      setTimeout(() => {
          document.getElementById('settings').style.display = 'none';
      }, 1000);
    });
  }
});

document.getElementById("optimizeBtn").addEventListener("click", async () => {
  setStatus("Reading text...", "black");

  // 1. Check for API Key
  const stored = await chrome.storage.sync.get(['llmbda_api_key']);
  const apiKey = stored.llmbda_api_key;

  if (!apiKey) {
    setStatus("Error: Please set API Key below.", "red");
    document.getElementById('settings').style.display = 'block';
    return;
  }

  // 2. Get Tab Content
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

    // 3. Call AI API
    try {
      const optimizedText = await callGroqAPI(apiKey, originalText);
      
      // 4. Paste back to page
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: setPageInput,
        args: [optimizedText]
      });
      
      setStatus("Optimized!", "green");
    } catch (error) {
      console.error(error);
      setStatus("API Error. Check Key.", "red");
    }
  });
});

// --- HELPER FUNCTIONS ---

function setStatus(msg, color) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = color || 'black';
}

async function callGroqAPI(apiKey, text) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        {
          role: "system", 
          content: "You are a prompt optimizer. Your purpose is to minimize the number of tokens in a prompt. Rewrite the user's input to be as concise and token-efficient as possible while retaining 100% of the meaning and intent. Do not answer the prompt, only optimize it. Do not add conversational filler. Output ONLY the optimized prompt."
        },
        { role: "user", content: text }
      ],
      temperature: 0.3
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// --- CONTENT SCRIPTS (Run inside the page) ---

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
    // Focus and select all text to ensure clean replacement
    el.focus();
    
    // For ContentEditable (Gemini/Claude)
    if (el.isContentEditable) {
        el.innerText = newText;
    } else {
        // For Textareas (ChatGPT)
        el.value = newText;
    }
    
    // Dispatch events to trigger UI updates (React/Angular)
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}