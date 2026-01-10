from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llmlingua import PromptCompressor
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Initialize App
app = FastAPI()

# Allow your Chrome Extension to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace '*' with your Extension ID (chrome-extension://...)
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading LLMLingua-2 Model... (This happens only once)")
# Using the small, fast BERT-based model (good for CPU)
compressor = PromptCompressor(
    model_name="microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
    use_llmlingua2=True,
    device_map="cpu" # Change to "cuda" if you have an NVIDIA GPU
)
print("Model Loaded!")

class OptimizeRequest(BaseModel):
    prompt: str
    target_token: int = 200 # Default target length
    rate: float = 0.5       # Default compression rate (50%)

@app.post("/optimize")
async def optimize_prompt(req: OptimizeRequest):
    try:
        # LLMLingua optimization call
        result = compressor.compress_prompt(
            [req.prompt],
            rate=req.rate,
            force_tokens=['\n', '?'], # Ensure formatting/questions are kept
            drop_consecutive=True
        )
        
        return {
            "optimized_prompt": result['compressed_prompt'],
            "original_tokens": result['origin_tokens'],
            "compressed_tokens": result['compressed_tokens'],
            "ratio": result['ratio']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)