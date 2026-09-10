# TTS Provider Comparison — JARVIS Phase 4

*Researched 2026-09-09. Verify pricing/features before implementation — these services update frequently.*

---

## Provider Rankings (JARVIS suitability)

| # | Provider | JARVIS similarity | Streaming | Free tier | Est. monthly (always-on) | Python SDK |
|---|----------|------------------|-----------|-----------|--------------------------|------------|
| 1 | **ElevenLabs Bill** (current) | 8/10 | ✅ PCM chunks | 10k chars/mo (no clone) | ~$5–22 | ✅ |
| 2 | **Deepgram Flux** | 6/10 | ✅ 80ms first chunk | ✅ FREE until Sep 13 2026 | $0.045/1k chars | ✅ |
| 3 | **Cartesia Sonic** | TBD | ✅ ultra-low latency | 20k credits (~27 min/mo) | $5/mo Pro | ✅ |
| 4 | **OpenAI `onyx`** | 6/10 | ✅ PCM/WAV chunks | None | Pay-per-use | ✅ |
| 5 | **Kokoro TTS** (local) | 7/10 | ✅ sentence-level | **Free forever** | $0 | ✅ |
| 6 | **Fish Audio** | varies | ✅ low-latency | Free personal tier | Pay-per-use | ✅ |
| 7 | **Resemble.ai** | 7/10 | unclear | Flex (pay-per-use) | $350/mo Team | ✅ |

---

## Detailed Notes

### ElevenLabs (current — Bill voice)
- Voice ID `pqHfZKP75CvOlQylNhV4` already configured
- **Instant Voice Clone**: $6/mo Starter tier — upload 1 min of JARVIS audio → near-perfect clone
- **Professional Voice Clone**: $22/mo Creator tier → best quality possible
- Streaming: PCM chunks, `eleven_turbo_v2_5` model, ~100–200ms to first chunk
- Pipecat: `ElevenLabsTTSService` built-in

### Deepgram Flux TTS
- **Best latency**: 80ms to first audio chunk — fastest of all cloud options
- Free until September 13, 2026 (45 concurrent connections globally)
- Post-free: $0.045 per 1,000 characters
- Voices: Alexandra, Paolo and others — no specifically British/JARVIS-like voice confirmed
- Pipecat: `DeepgramTTSService` available
- **Recommended as fallback** for lowest latency once free tier expires

### Cartesia Sonic
- Free tier: 20k credits/month (~27 min TTS)
- Instant Voice Clone: $5/mo Pro plan
- Professional clone: $49/mo Startup plan
- Ultra-low latency streaming — sub-100ms claims
- British voices: unconfirmed from website, check their voice library
- Pipecat: `CartesiaTTSService` available
- **Best option to test for JARVIS feel** — free instant clone at $5/mo

### OpenAI TTS
- 13 voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
- `onyx`: deep male voice — closest to JARVIS but American accent
- `fable`: British accent, warm — second closest
- Streaming: full PCM/WAV chunk support
- Pricing: ~$15 per 1M chars (tts-1) / $30 per 1M chars (tts-1-hd)
- No voice cloning
- Pipecat: `OpenAITTSService` built-in

### Kokoro TTS (local, free)
- 82M parameter model — tiny, CPU-viable
- `pip install kokoro>=0.9.2`
- British voices available (check VOICES.md in hexgrad/Kokoro-82M)
- Zero cost, no API key, runs on Azure VM CPU
- Quality: good for local, not ElevenLabs-grade
- Streaming: sentence-level (generate chunk per sentence)
- **Best zero-cost option** — use as offline fallback

### Fish Audio
- 2,000,000+ community voices — search "JARVIS" or "British AI" in their library
- Voice clone from 15-second clip — fastest cloning onboarding
- Free personal tier, pay-per-use for commercial
- Streaming API with ultra-low latency
- Worth checking their voice marketplace for existing JARVIS-like models

---

## Recommendation for Jarvis Phase 4

**Primary**: ElevenLabs Bill (already configured) — upgrade to $6/mo Starter for Instant Voice Clone with real JARVIS audio  
**Free alternative**: Kokoro TTS local (British voice, zero cost)  
**Lowest latency**: Deepgram Flux (80ms, currently free)  
**Best clone quality**: ElevenLabs Creator $22/mo for Professional Voice Clone  
**Worth testing**: Cartesia Sonic — free instant clone at $5/mo, very low latency  

All providers implemented as swappable via `JARVIS_TTS_PROVIDER` env var (see phase4-voice.md).
