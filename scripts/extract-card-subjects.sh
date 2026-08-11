#!/bin/sh
set -eu

output_dir="public/landing/subjects"
mkdir -p "$output_dir"

for source_path in public/cards/fronts/*.webp; do
  card_name="$(basename "$source_path" .webp)"
  ffmpeg -y -loglevel error -i "$source_path" \
    -vf "crop=iw*0.62:ih*0.72:iw*0.19:ih*0.09,scale=190:-1:flags=lanczos,colorkey=0xF4EADC:0.18:0.10,format=rgba" \
    "$output_dir/$card_name.png"
done

printf 'Created %s transparent subject cutouts.\n' "$(find "$output_dir" -type f -name '*.png' | wc -l | tr -d ' ')"
