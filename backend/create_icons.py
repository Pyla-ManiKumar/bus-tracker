from PIL import Image, ImageDraw
import os

# Build path step by step
base = os.path.expanduser("~")
folder = os.path.join(base, "bus-tracker", "frontend", "icons")

print(f"Saving icons to: {folder}")

# Force create folder
os.makedirs(folder, exist_ok=True)

# Check folder exists
if os.path.isdir(folder):
    print(f"✅ Folder confirmed: {folder}")
else:
    print(f"❌ Folder NOT found: {folder}")
    exit()

sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    img = Image.new('RGB', (size, size), color='#1d4ed8')
    draw = ImageDraw.Draw(img)

    margin = size // 8
    draw.ellipse(
        [margin, margin, size-margin, size-margin],
        fill='#ffffff'
    )

    bw = int(size * 0.5)
    bh = int(size * 0.3)
    bx = (size - bw) // 2
    by = (size - bh) // 2

    draw.rectangle(
        [bx, by, bx+bw, by+bh],
        fill='#1d4ed8'
    )

    draw.rectangle(
        [bx+int(bw*0.1), by+int(bh*0.15),
         bx+int(bw*0.35), by+int(bh*0.55)],
        fill='white'
    )

    draw.rectangle(
        [bx+int(bw*0.45), by+int(bh*0.15),
         bx+int(bw*0.7), by+int(bh*0.55)],
        fill='white'
    )

    wr = int(size * 0.07)
    draw.ellipse(
        [bx+int(bw*0.15)-wr, by+bh-wr,
         bx+int(bw*0.15)+wr, by+bh+wr],
        fill='#1e293b'
    )

    draw.ellipse(
        [bx+int(bw*0.75)-wr, by+bh-wr,
         bx+int(bw*0.75)+wr, by+bh+wr],
        fill='#1e293b'
    )

    # Save file
    filename = f"icon-{size}.png"
    path = os.path.join(folder, filename)

    try:
        img.save(path)
        print(f"✅ Saved: {path}")
    except Exception as e:
        print(f"❌ Failed to save {filename}: {e}")

print("\n🎉 Done!")