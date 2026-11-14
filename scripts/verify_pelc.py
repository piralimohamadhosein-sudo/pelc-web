#!/usr/bin/env python3
"""Verify the pelc repo before zipping: file integrity, placeholders, XML/JSON validity."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path("/home/z/my-project/download/pelc")

REQUIRED = [
    "settings.gradle.kts", "build.gradle.kts", "gradle.properties",
    "gradle/libs.versions.toml", "gradle/wrapper/gradle-wrapper.properties",
    "gradle/wrapper/gradle-wrapper.jar", "gradlew", "gradlew.bat",
    ".gitignore", ".gitattributes", "LICENSE", "README.md", "CHANGELOG.md",
    "CONTRIBUTING.md", "docs/ARCHITECTURE.md", "docs/ROADMAP.md",
    "docs/EXPORT_FORMATS.md", "docs/FONT_LICENSES.md", "docs/UPLOAD_TO_GITHUB.md",
    ".github/workflows/android-ci.yml", ".github/workflows/release.yml",
    "scripts/fetch-fonts.sh", "scripts/fetch-native-deps.sh",
    "core-model/build.gradle.kts",
    "core-model/src/main/kotlin/ir/pelc/core/model/PelcDocument.kt",
    "core-model/src/main/kotlin/ir/pelc/core/model/TextContent.kt",
    "core-model/src/main/kotlin/ir/pelc/core/model/Outline.kt",
    "core-model/src/main/kotlin/ir/pelc/core/model/PelcJson.kt",
    "core-model/src/test/kotlin/ir/pelc/core/model/DocumentSerializationTest.kt",
    "core-shaping/build.gradle.kts",
    "core-shaping/src/main/kotlin/ir/pelc/core/shaping/HarfBuzzJni.kt",
    "core-shaping/src/main/kotlin/ir/pelc/core/shaping/Shaper.kt",
    "core-shaping/src/main/kotlin/ir/pelc/core/shaping/TextLayouter.kt",
    "core-shaping/src/main/kotlin/ir/pelc/core/shaping/VariantDetector.kt",
    "core-shaping/src/main/cpp/CMakeLists.txt",
    "core-shaping/src/main/cpp/harfbuzz_jni.cpp",
    "core-render/src/main/kotlin/ir/pelc/core/render/PelcRenderer.kt",
    "core-render/src/main/kotlin/ir/pelc/core/render/OutlineToPath.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/ExportFormat.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/ExportOrchestrator.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/svg/SvgWriter.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/dxf/DxfWriter.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/psd/PsdWriter.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/psd/PsdComposer.kt",
    "core-export/src/main/kotlin/ir/pelc/core/export/project/PelcProjectIO.kt",
    "core-export/src/test/kotlin/ir/pelc/core/export/PsdWriterTest.kt",
    "core-export/src/test/kotlin/ir/pelc/core/export/SvgWriterTest.kt",
    "core-export/src/test/kotlin/ir/pelc/core/export/DxfWriterTest.kt",
    "feature-fonts/src/main/kotlin/ir/pelc/feature/fonts/FontRepository.kt",
    "feature-fonts/src/main/assets/fonts/fonts.json",
    "feature-editor/src/main/kotlin/ir/pelc/feature/editor/EditorViewModel.kt",
    "feature-editor/src/main/kotlin/ir/pelc/feature/editor/EditorScreen.kt",
    "feature-editor/src/main/res/values/strings.xml",
    "feature-export/src/main/kotlin/ir/pelc/feature/export/ExportWorker.kt",
    "feature-export/src/main/kotlin/ir/pelc/feature/export/ExportViewModel.kt",
    "feature-export/src/main/kotlin/ir/pelc/feature/export/ExportSheet.kt",
    "app/build.gradle.kts", "app/src/main/AndroidManifest.xml",
    "app/src/main/kotlin/ir/pelc/app/PelcApp.kt",
    "app/src/main/kotlin/ir/pelc/app/MainActivity.kt",
    "app/src/main/kotlin/ir/pelc/app/di/AppModule.kt",
    "app/src/main/kotlin/ir/pelc/app/ui/theme/Theme.kt",
    "app/src/main/res/values/strings.xml", "app/src/main/res/values/themes.xml",
    "app/src/main/res/xml/file_paths.xml",
]

PLACEHOLDER_PATTERNS = re.compile(r"TODO|FIXME|XXX|待补充|undefined|NaN|【.+?】")

errors = []

# 1. Required files exist and are non-empty
for rel in REQUIRED:
    p = ROOT / rel
    if not p.exists():
        errors.append(f"MISSING: {rel}")
    elif p.stat().st_size == 0:
        errors.append(f"EMPTY: {rel}")

# 2. Placeholder scan in source/text files
scan_exts = {".kt", ".kts", ".cpp", ".xml", ".md", ".yml", ".toml", ".sh", ".json", ".pro"}
for p in ROOT.rglob("*"):
    if p.is_file() and p.suffix in scan_exts and ".git" not in p.parts:
        try:
            text = p.read_text(encoding="utf-8")
        except Exception as e:
            errors.append(f"READ FAIL: {p.relative_to(ROOT)}: {e}")
            continue
        for m in PLACEHOLDER_PATTERNS.finditer(text):
            snippet = text[max(0, m.start()-40):m.end()+40].replace("\n", " ")
            errors.append(f"PLACEHOLDER {p.relative_to(ROOT)}: ...{snippet}...")

# 3. XML validity
for p in ROOT.rglob("*.xml"):
    if ".git" in p.parts:
        continue
    try:
        ET.parse(p)
    except Exception as e:
        errors.append(f"XML INVALID: {p.relative_to(ROOT)}: {e}")

# 4. JSON validity
for p in ROOT.rglob("*.json"):
    if ".git" in p.parts:
        continue
    try:
        json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"JSON INVALID: {p.relative_to(ROOT)}: {e}")

# 5. Rough brace balance for Kotlin files
for p in ROOT.rglob("*.kt"):
    if ".git" in p.parts:
        continue
    text = p.read_text(encoding="utf-8")
    # strip string literals and comments (rough but effective for balance check)
    cleaned = re.sub(r'"""[\s\S]*?"""', "", text)
    cleaned = re.sub(r'"(?:[^"\\\n]|\\.)*"', "", cleaned)
    cleaned = re.sub(r"//[^\n]*", "", cleaned)
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", cleaned)
    if cleaned.count("{") != cleaned.count("}"):
        errors.append(
            f"BRACE MISMATCH {p.relative_to(ROOT)}: "
            f"{cleaned.count('{')} open vs {cleaned.count('}')} close"
        )

# 6. JNI symbol consistency
jni_cpp = (ROOT / "core-shaping/src/main/cpp/harfbuzz_jni.cpp").read_text(encoding="utf-8")
jni_kt = (ROOT / "core-shaping/src/main/kotlin/ir/pelc/core/shaping/HarfBuzzJni.kt").read_text(encoding="utf-8")
for symbol in ["createFont", "destroyFont", "shape", "glyphOutline", "gsubFeatureTags"]:
    cpp_sym = f"Java_ir_pelc_core_shaping_HarfBuzzJni_{symbol}"
    if cpp_sym not in jni_cpp:
        errors.append(f"JNI SYMBOL MISSING in cpp: {cpp_sym}")
    if f"external fun {symbol}" not in jni_kt:
        errors.append(f"JNI DECL MISSING in kotlin: {symbol}")

# 7. Summary
kt_files = len(list(ROOT.rglob("*.kt")))
total_files = sum(1 for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts)
print(f"Kotlin files: {kt_files}")
print(f"Total files (excl. .git): {total_files}")

if errors:
    print(f"\nFAILED with {len(errors)} problem(s):")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("\nALL CHECKS PASSED")
