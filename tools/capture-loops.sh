#!/bin/zsh
# Re-capture the fallback videos in a headless Chrome, using a throwaway profile.
#
#   npm run dev            (in another terminal: capture saves through the dev server)
#   npm run capture
#
# Env: PORT (5173), FPS (24), KEEP=1 to keep the PNG frames in .capture/, MODES ("landscape portrait"),
# CHROME to override the browser path. Writes public/grass/loop-{landscape,portrait}.{mp4,webm,jpg}.
set -u
cd "${0:A:h}/.."

CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
PORT=${PORT:-5173}
FPS=${FPS:-24}
KEEP=${KEEP:-0}
TIMEOUT=${TIMEOUT:-1500}
MODES=${MODES:-landscape portrait}

if ! curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/"; then
  echo "No dev server on port $PORT. Start one with: npm run dev" >&2
  exit 1
fi

profile=$(mktemp -d)
marker=$(mktemp)
trap 'rm -rf "$profile" "$marker"' EXIT

for mode in ${=MODES}; do
  name=loop-$mode
  # Portrait shows the grass closer up, so the same quality costs more than twice the size.
  encoder=""
  [ $mode = portrait ] && encoder="&crf=34&vp9crf=50"
  touch "$marker"
  sleep 1
  started=$(date +%s)
  "$CHROME" --headless=new --user-data-dir="$profile" --no-first-run --no-default-browser-check \
    --disable-background-timer-throttling --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows --use-angle=metal --ignore-gpu-blocklist \
    --window-size=1280,720 \
    "http://localhost:$PORT/?capture=$mode&fps=$FPS&keep=$KEEP$encoder" >/dev/null 2>&1 &
  browser=$!

  until [ public/grass/$name.webm -nt "$marker" ] && ! pgrep -f "$name.webm" >/dev/null; do
    if [ $(( $(date +%s) - started )) -gt $TIMEOUT ]; then
      echo "$mode timed out" >&2
      kill $browser 2>/dev/null
      exit 1
    fi
    sleep 2
  done
  kill $browser 2>/dev/null
  wait $browser 2>/dev/null
  echo "$mode: done in $(( $(date +%s) - started ))s"
done
ls -la public/grass | grep -E 'loop-(landscape|portrait)'
