# Open-Source / Free JARVIS Voice Options

## Pre-trained JARVIS models on HuggingFace

### 1. DominicSchwantes/Xtts-JARVIS-voice-clone ⭐⭐⭐⭐
- **Type**: XTTS v2 fine-tune (Coqui TTS framework)
- **Framework**: XTTS — zero-shot voice cloning + fine-tuning WebUI
- **Quality**: High if fine-tuned on good audio
- **Real-time**: Sentence-level streaming, ~500ms first chunk on CPU
- **RAM**: ~4GB CPU, ~2GB GPU
- **Setup**:
  ```bash
  git clone https://huggingface.co/DominicSchwantes/Xtts-JARVIS-voice-clone
  # Uses XTTS fine-tuning WebUI at localhost:5003
  # Windows: run install.bat → start.bat
  # Linux: ./install.sh → ./start.sh
  pip install TTS  # Coqui TTS
  ```
- **Inference**:
  ```python
  from TTS.api import TTS
  tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
  tts.tts_to_file(text="Good morning, Sir.", speaker_wav="jarvis_ref.wav", 
                  language="en", file_path="out.wav")
  ```
- **Note**: Needs a reference audio clip of JARVIS for zero-shot. The fine-tuned weights bake the voice in — no reference needed.

### 2. iceTea911/JARVIS_voice_finetuned_orpheus_16bit ⭐⭐⭐⭐⭐ (Best)
- **Type**: Orpheus 3B TTS model fine-tuned on JARVIS voice data
- **Framework**: Orpheus-TTS (LLM-based, very natural prosody)
- **Quality**: Highest quality of all free options — LLM-based means natural rhythm
- **Real-time**: Needs GPU for fast inference (~8B equivalent); CPU possible but slow
- **RAM**: ~6GB GPU (BF16), ~12GB CPU RAM
- **Model ID**: `iceTea911/JARVIS_voice_finetuned_orpheus_16bit`
- **Also**: `iceTea911/JARVIS_voice_orpheus-3b-0.1-ft-unsloth-bnb-4bit_finetune_4bit` — 4-bit quantized, ~3GB GPU
- **Setup**:
  ```bash
  pip install transformers torch vllm
  # Fast inference via vLLM:
  vllm serve "iceTea911/JARVIS_voice_finetuned_orpheus_16bit"
  # Or 4-bit quantized (fits in 3GB GPU / 8GB RAM CPU):
  vllm serve "iceTea911/JARVIS_voice_orpheus-3b-0.1-ft-unsloth-bnb-4bit_finetune_4bit"
  ```
- **Orpheus TTS inference**:
  ```python
  from orpheus_tts import OrpheusModel
  model = OrpheusModel(model_id="iceTea911/JARVIS_voice_finetuned_orpheus_16bit")
  stream = model.generate_speech(prompt="At your service, Sir.")
  # Streams PCM audio
  ```

### 3. Kokoro-82M British Male Voices ⭐⭐⭐ (Free, fastest)
- **Type**: Local neural TTS, 82M params
- **Voices**: `bm_george`, `bm_fable`, `bm_lewis`, `bm_daniel` (all British male)
- **Best JARVIS match**: `bm_george` or `bm_fable` (Grade C — decent quality)
- **Real-time**: YES — extremely fast on CPU, ~50ms first chunk
- **RAM**: <500MB
- **Setup**:
  ```bash
  pip install kokoro soundfile
  ```
  ```python
  from kokoro import KPipeline
  pipeline = KPipeline(lang_code='b')  # British English
  audio, _ = pipeline("Good morning, Sir.", voice='bm_george')
  # Returns numpy array at 24kHz
  ```
- **Note**: Quality grade C/D — not JARVIS-level, but instant, free, and CPU-capable.

### 4. Piper TTS (OHF-Voice/piper1-gpl) ⭐⭐⭐ (Fastest local)
- **Type**: Fast local neural TTS binary
- **License**: GPL (free)
- **Speed**: Fastest local option — real-time factor >40x (well under 100ms)
- **British male voices**: Available in en_GB voice set
- **RAM**: <200MB
- **Setup**:
  ```bash
  # Download binary + voice model
  pip install piper-tts
  # or use binary: piper --model en_GB-alan-medium --output-file out.wav
  echo "Good morning, Sir." | piper --model en_GB-alan-medium --output-raw | aplay
  ```
- **Streaming**: Supports raw PCM streaming via pipe — integrates directly into Pipecat
- **Note**: Voice quality lower than Orpheus/XTTS but latency is near-zero.

## RVC (Retrieval-based Voice Conversion)

RVC converts any TTS output to sound like JARVIS by voice conversion (not TTS directly):

### Pre-trained JARVIS RVC models
- Search Weights.gg for "JARVIS" and "Iron Man" — community has shared RVC v2 models
- Also check: `huggingface.co/search?q=jarvis+rvc`

### RVC pipeline for Jarvis
```
Kokoro/Piper TTS → PCM audio → RVC v2 (JARVIS model) → JARVIS-sounding output
```
- **Latency add**: ~100–200ms on GPU, 300–500ms on CPU
- **Quality**: Transforms any voice to sound like Paul Bettany
- **Setup**:
  ```bash
  git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
  pip install -r requirements.txt
  # Download JARVIS .pth model from community
  python infer/infer.py --input audio.wav --model jarvis.pth
  ```

## Summary Table

| Option | Cost | Quality | Real-time | RAM | Best for |
|--------|------|---------|-----------|-----|---------|
| Orpheus 3B JARVIS fine-tune | Free | ⭐⭐⭐⭐⭐ | GPU only | 3–6GB GPU | Best quality, has GPU |
| XTTS v2 JARVIS clone | Free | ⭐⭐⭐⭐ | CPU ok | 4GB | Quality + CPU |
| Kokoro bm_george/fable | Free | ⭐⭐⭐ | ✅ <50ms | <500MB | Speed on CPU |
| Piper en_GB + RVC | Free | ⭐⭐⭐⭐ | ✅ ~200ms | <500MB | Best CPU pipeline |
| Kokoro + RVC JARVIS model | Free | ⭐⭐⭐⭐ | ~300ms | <1GB | Free + convincing |
