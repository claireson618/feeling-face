#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h}/.."
app_dir="$project_dir/Feeling Face.app"
contents_dir="$app_dir/Contents"

mkdir -p "$contents_dir/MacOS" "$contents_dir/Resources"
cp "$project_dir/macos/Info.plist" "$contents_dir/Info.plist"
cp "$project_dir/macos/FeelingFace.icns" "$contents_dir/Resources/FeelingFace.icns"
cp "$project_dir/server.mjs" "$contents_dir/Resources/server.mjs"
ditto "$project_dir/public" "$contents_dir/Resources/public"
xcrun swiftc -O -framework AppKit -framework WebKit "$project_dir/macos/FeelingFace.swift" -o "$contents_dir/MacOS/FeelingFace"
codesign --force --deep --sign - "$app_dir"
echo "Built: $app_dir"
