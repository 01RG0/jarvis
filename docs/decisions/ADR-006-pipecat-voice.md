# ADR-006: Pipecat for Voice Pipeline

**Status:** Accepted  
**Date:** 2026-09-08

## Context

Full-duplex voice requires: VAD (voice activity detection), STT, LLM integration, TTS, and WebSocket streaming to the browser. A Python-native, cloud-API-first solution is needed that doesn't require local model weights (8 GB RAM constraint).

## Decision

**Pipecat** (`pipecat-ai/pipecat`) for the voice pipeline.

## Consequences

**Positive:**
- Composable pipeline stages: plug in different STT (Deepgram, Whisper-via-API), TTS (ElevenLabs, Cartesia), LLM providers without rewriting the pipeline
- Cloud-API-first by design — no local model weights anywhere in the pipeline
- Full-duplex streaming: audio starts playing before the LLM finishes generating (streaming TTS)
- Multi-agent handoff: Pipecat supports handing off mid-conversation to a specialized agent — relevant for Phase 3 (CLI dispatch) and future multi-agent scenarios
- Python-native — same venv as the brain

**Negative:**
- Pipecat is relatively new (2024) — API may change between versions
- WebSocket audio handling between browser and Pipecat's server requires a bridge (handled by the Node gateway)

## Alternatives Considered

**LiveKit Agents:** Better if telephony scale, SIP, or multi-participant rooms are needed. Steeper ops overhead (LiveKit server). For a single-user personal assistant, this is overkill.

**Whisper + ElevenLabs directly (no framework):** Could build the pipeline manually without Pipecat. More control but more maintenance — Pipecat's composable stages and provider library handle the boilerplate so you don't have to.

**Vocode:** Similar to Pipecat, older, less maintained as of 2025.
