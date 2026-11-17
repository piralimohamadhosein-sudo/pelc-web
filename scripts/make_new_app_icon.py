#!/usr/bin/env python3
"""تبدیل آیکون جدیدِ آپلودی (JPG با پس‌زمینهٔ سفید) به PNG شفاف ۵۱۲×۵۱۲.

۱) پس‌زمینهٔ سفید با flood-fill از چهار گوشه حذف می‌شود (برقِ داخل آیکون دست نمی‌خورد)
۲) برش به کادر کاشی + تبدیل به ۵۱۲×۵۱۲
۳) رنگ سبز حاشیه برای پس‌زمینهٔ آیکون تطبیقی نمونه‌برداری می‌شود
"""
from PIL import Image, ImageDraw

SRC = "/home/z/my-project/upload/pasted_image_1794939404353.jpg"
DST = "/home/z/my-project/src/app/icon.png"

im = Image.open(SRC).convert("RGB")
w, h = im.size

# ۱) flood-fill سفید از گوشه‌ها — با آستانه برای هالهٔ نرم اطراف کاشی
marker = (255, 0, 255)
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
    # فقط اگر پیکسل شروع سفید است
    if sum(im.getpixel(seed)) / 3 > 235:
        ImageDraw.floodfill(im, seed, marker, thresh=30)

rgba = im.convert("RGBA")
px = rgba.load()
removed = 0
for y in range(h):
    for x in range(w):
        if px[x, y][:3] == marker:
            px[x, y] = (0, 0, 0, 0)
            removed += 1
print(f"transparent pixels: {removed}")

# ۲) برش به محتوای کاشی
bbox = rgba.getbbox()
print("tile bbox:", bbox)
tile = rgba.crop(bbox)
side = max(tile.size)
# مربع‌سازی (اگر کاشی کمی نامتقارن باشد)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(tile, ((side - tile.size[0]) // 2, (side - tile.size[1]) // 2), tile)
out = sq.resize((512, 512), Image.LANCZOS)
out.save(DST)
print("saved:", DST, out.size)

# ۳) نمونه‌برداری رنگ سبز برای پس‌زمینهٔ تطبیقی — میانگین نوار لبهٔ داخلی
samples = []
for fx, fy in [(0.14, 0.5), (0.86, 0.5), (0.5, 0.14), (0.5, 0.86), (0.2, 0.2), (0.8, 0.8)]:
    x = int(512 * fx); y = int(512 * fy)
    r, g, b, a = out.getpixel((x, y))
    if a > 200:
        samples.append((r, g, b))
avg = tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))
hexcolor = "#{:02x}{:02x}{:02x}".format(*avg)
print("adaptive bg color:", hexcolor, "samples:", samples)
open("/tmp/icon_bg_color.txt", "w").write(hexcolor)
