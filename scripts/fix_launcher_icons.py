#!/usr/bin/env python3
"""بازتولید آیکون‌های لانچر اندروید با رعایت safe zone آیکون تطبیقی.

- foreground تطبیقی: محتوا ~۶۰٪ بوم، وسط‌چین، اطراف شفاف (بدون بیرون‌زدگی از ماسک)
- round قدیمی: محتوا ~۸۶٪ روی پس‌زمینهٔ سبز یکدست (ماسک دایره‌ای گوشه‌ها را نمی‌برد)
- square قدیمی: تایل کامل مربع (استاندارد لانچرهای قدیمی)
"""
from PIL import Image

SRC = "/home/z/my-project/src/app/icon.png"
RES = "/home/z/my-project/android/app/src/main/res"
BG = (25, 101, 85, 255)  # #196555 — سبز پس‌زمینهٔ آیکون پلک

im = Image.open(SRC).convert("RGBA")

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
FG_BASE = 108  # dp بوم آیکون تطبیقی
LEGACY_BASE = 48  # dp آیکون قدیمی

for dpi, factor in DENSITIES.items():
    # --- adaptive foreground: 108dp بوم، محتوا فقط ~۶۰dp (safe zone) ---
    fg_px = round(FG_BASE * factor)
    content_px = round(fg_px * 60 / 108)  # 60dp داخل safe zone ۶۶dp
    icon_scaled = im.resize((content_px, content_px), Image.LANCZOS)
    fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
    off = (fg_px - content_px) // 2
    fg.paste(icon_scaled, (off, off), icon_scaled)
    fg.save(f"{RES}/mipmap-{dpi}/ic_launcher_foreground.png")

    # --- legacy square: تایل کامل ---
    sq_px = round(LEGACY_BASE * factor)
    im.resize((sq_px, sq_px), Image.LANCZOS).save(f"{RES}/mipmap-{dpi}/ic_launcher.png")

    # --- legacy round: محتوا ۸۶٪ روی سبز یکدست تا ماسک دایره‌ای گوشه را نبرد ---
    rd_px = round(LEGACY_BASE * factor)
    inner = round(rd_px * 0.86)
    icon_in = im.resize((inner, inner), Image.LANCZOS)
    rd = Image.new("RGBA", (rd_px, rd_px), BG)
    o = (rd_px - inner) // 2
    rd.paste(icon_in, (o, o), icon_in)
    rd.save(f"{RES}/mipmap-{dpi}/ic_launcher_round.png")

    print(f"{dpi}: fg={fg_px}px content={content_px}px | square={sq_px}px | round={rd_px}px inner={inner}px")

print("done")
