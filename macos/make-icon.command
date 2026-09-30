#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h}/.."
iconset_dir="$project_dir/macos/FeelingFace.iconset"
master_png="$project_dir/macos/icon.svg.png"

mkdir -p "$iconset_dir"
qlmanage -t -s 1024 -o "$project_dir/macos" "$project_dir/public/icon.svg"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$master_png" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
done

for size in 16 32 128 256 512; do
  doubled=$((size * 2))
  sips -z "$doubled" "$doubled" "$master_png" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$iconset_dir" -o "$project_dir/macos/FeelingFace.icns"
echo "Created: $project_dir/macos/FeelingFace.icns"
