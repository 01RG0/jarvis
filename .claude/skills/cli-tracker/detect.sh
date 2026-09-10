#!/usr/bin/env bash
# Dynamically discovers coding/AI agent CLIs in PATH.
# Prints JSON: { "known": {...}, "dynamic": {...} }
set -u

check() { command -v "$1" >/dev/null 2>&1 && echo "\"$1\": \"$(command -v "$1")\"" || true; }

KNOWN_PATTERNS="jules grok agy codex kilo kilocode freebuff cursor cursor-agent vibe"
DYNAMIC_PATTERNS="code agent copilot coder llm gemini openai claude mistral forge pilot codegen"

printf '{\n  "known": {\n'
first=true
for cli in $KNOWN_PATTERNS; do
  path=$(command -v "$cli" 2>/dev/null || true)
  [ -z "$path" ] && continue
  $first && first=false || printf ',\n'
  printf '    "%s": "%s"' "$cli" "$path"
done
printf '\n  },\n  "dynamic": {\n'

first=true
seen=" $KNOWN_PATTERNS "
IFS=':' read -ra DIRS <<< "${PATH:-}"
for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || continue
  for bin in "$dir"/*; do
    name=$(basename "$bin" 2>/dev/null) || continue
    name_lower=$(echo "$name" | tr '[:upper:]' '[:lower:]')
    stem="${name_lower%%.*}"
    echo "$seen" | grep -q " $stem " && continue
    found_kw=false
    for kw in $DYNAMIC_PATTERNS; do
      echo "$stem" | grep -q "$kw" && { found_kw=true; break; }
    done
    $found_kw || continue
    command -v "$stem" >/dev/null 2>&1 || continue
    seen="$seen$stem "
    path=$(command -v "$stem")
    $first && first=false || printf ',\n'
    printf '    "%s": "%s"' "$stem" "$path"
  done
done
printf '\n  }\n}\n'
