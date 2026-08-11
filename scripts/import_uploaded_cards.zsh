#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
FRONTS_DIR="$PROJECT_DIR/public/cards/fronts"
BACKS_DIR="$PROJECT_DIR/public/cards/backs"

if (( $# == 0 )); then
  print -u2 "用法：$0 <preview文件夹> [更多preview文件夹...]"
  exit 2
fi

SOURCE_DIRS=("$@")

RANKS=(ace two three four five six seven eight nine ten page knight queen king)

card_id_for_index() {
  local index="$1"
  if (( index < 22 )); then
    printf "m%02d" "$index"
  elif (( index < 36 )); then
    printf "wands-%s" "${RANKS[$((index - 21))]}"
  elif (( index < 50 )); then
    printf "cups-%s" "${RANKS[$((index - 35))]}"
  elif (( index < 64 )); then
    printf "swords-%s" "${RANKS[$((index - 49))]}"
  else
    printf "pentacles-%s" "${RANKS[$((index - 63))]}"
  fi
}

mkdir -p "$FRONTS_DIR" "$BACKS_DIR"

failures=()

for source_dir in "${SOURCE_DIRS[@]}"; do
  if [[ ! -d "$source_dir" ]]; then
    failures+=("找不到文件夹：$source_dir")
    continue
  fi

  source_files=("$source_dir"/*.png(N))
  for source_file in "${source_files[@]}"; do
    filename="${source_file:t}"
    index_text="${filename%%_*}"
    index=$((10#$index_text))
    card_id="$(card_id_for_index "$index")"

    if [[ "$filename" == *_front.png ]]; then
      destination="$FRONTS_DIR/$card_id.webp"
    else
      destination="$BACKS_DIR/$card_id.webp"
    fi

    if ! cwebp -quiet -q 88 -m 6 -sharp_yuv "$source_file" -o "$destination"; then
      failures+=("转换失败：$source_file")
    fi
  done
done

front_count=$(find "$FRONTS_DIR" -name '*.webp' -type f | wc -l | tr -d ' ')
back_count=$(find "$BACKS_DIR" -name '*.webp' -type f | wc -l | tr -d ' ')
echo "Imported fronts: $front_count"
echo "Imported backs:  $back_count"
if (( ${#failures[@]} > 0 )); then
  print -u2 "以下素材尚未导入："
  printf '%s\n' "${failures[@]}" >&2
  exit 1
fi
