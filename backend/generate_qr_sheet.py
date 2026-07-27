import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

# Settings
folder = r"C:\Users\pylam\bus-tracker\bus_qr_codes"
os.makedirs(folder, exist_ok=True)

# A4 sheet size (in pixels at 300 DPI)
A4_WIDTH = 2480
A4_HEIGHT = 3508

# Grid: 5 columns x 5 rows
COLS = 5
ROWS = 5
MARGIN = 100
QR_SIZE = 380
LABEL_HEIGHT = 60

# Calculate cell size
cell_width = (A4_WIDTH - 2 * MARGIN) // COLS
cell_height = (A4_HEIGHT - 2 * MARGIN) // ROWS

# Create white A4 sheet
sheet = Image.new('RGB', (A4_WIDTH, A4_HEIGHT), 'white')
draw = ImageDraw.Draw(sheet)

# Try to load font
try:
    font = ImageFont.truetype("arial.ttf", 40)
    title_font = ImageFont.truetype("arialbd.ttf", 60)
except:
    font = ImageFont.load_default()
    title_font = ImageFont.load_default()

print("🎨 Creating printable QR sheet...\n")

# Generate and place QR codes
for i in range(25):
    bus_number = f"BUS-{i + 1:03d}"

    # Generate QR
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2
    )
    qr.add_data(bus_number)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color='black', back_color='white')
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE))

    # Calculate position
    col = i % COLS
    row = i // COLS

    x = MARGIN + col * cell_width + (cell_width - QR_SIZE) // 2
    y = MARGIN + row * cell_height

    # Paste QR
    sheet.paste(qr_img, (x, y))

    # Draw border box around QR + label
    box_x1 = MARGIN + col * cell_width + 20
    box_y1 = y - 10
    box_x2 = MARGIN + (col + 1) * cell_width - 20
    box_y2 = y + QR_SIZE + LABEL_HEIGHT + 10
    draw.rectangle([box_x1, box_y1, box_x2, box_y2], outline='black', width=3)

    # Add label below QR
    label_x = MARGIN + col * cell_width + cell_width // 2
    label_y = y + QR_SIZE + 15

    # Center the text
    bbox = draw.textbbox((0, 0), bus_number, font=font)
    text_width = bbox[2] - bbox[0]
    draw.text(
        (label_x - text_width // 2, label_y),
        bus_number,
        fill='black',
        font=font
    )

    print(f"✅ Added: {bus_number}")

# Save
output_path = os.path.join(folder, "ALL_BUS_QR_CODES_A4.png")
sheet.save(output_path, dpi=(300, 300))

print(f"\n🎉 A4 Printable Sheet saved:\n{output_path}")
print("\n📄 Print this on A4 paper, cut each QR, and stick on buses!")