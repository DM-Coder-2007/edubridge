from fastapi import FastAPI, UploadFile, File, HTTPException
from faster_whisper import WhisperModel
import tempfile
import os

app = FastAPI(title="AgroAssist Whisper Service")

MODEL_NAME = os.getenv("WHISPER_MODEL", "base.en")

print(f"Loading Whisper model: {MODEL_NAME}")

model = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8"
)

print("Whisper model loaded successfully.")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "faster-whisper",
        "model": MODEL_NAME
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No audio file provided"
        )

    suffix = os.path.splitext(file.filename)[1] or ".wav"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_path = temp_file.name

            content = await file.read()
            temp_file.write(content)

        segments, info = model.transcribe(
            temp_path,
            beam_size=5
        )

        text = " ".join(
            segment.text.strip()
            for segment in segments
        ).strip()

        return {
            "success": True,
            "text": text,
            "language": info.language,
            "language_probability": info.language_probability
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)