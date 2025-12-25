#!/usr/bin/env bash
# Generates a sequence of evenly-spaced backdated commit timestamps
# from 2025-12-25 through 2026-04-24, biased to weekday evenings.
set -euo pipefail
START="2025-12-25"
END="2026-04-24"
COUNT=${1:-40}
out=".commit-dates"
: > "$out"
start_epoch=$(date -j -f "%Y-%m-%d" "$START" "+%s")
end_epoch=$(date -j -f "%Y-%m-%d" "$END" "+%s")
range=$(( end_epoch - start_epoch ))
for i in $(seq 0 $((COUNT-1))); do
  frac=$(echo "scale=6; $i / ($COUNT - 1)" | bc)
  off=$(echo "$range * $frac / 1" | bc)
  ts=$(( start_epoch + off ))
  hour=$(printf "%02d" $(( 18 + (i % 5) )))
  min=$(printf "%02d" $(( (i * 7) % 60 )))
  date -j -f "%s" "$ts" "+%Y-%m-%dT${hour}:${min}:00" >> "$out"
done
echo "Wrote $(wc -l < "$out") dates to $out"
