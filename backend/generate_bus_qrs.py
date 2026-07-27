import qrcode
import os

# Path to save QR codes
folder = r"C:\Users\pylam\bus-tracker\bus_qr_codes"
os.makedirs(folder, exist_ok=True)

print("🎫 Generating 25 Bus QR Codes...\n")

for i in range(1, 26):
    bus_number = f"BUS-{i:03d}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=15,
        border=4
    )
    qr.add_data(bus_number)
    qr.make(fit=True)

    img = qr.make_image(fill_color='black', back_color='white')

    path = os.path.join(folder, f"{bus_number}.png")
    img.save(path)
    print(f"✅ Created: {bus_number}.png")

print(f"\n🎉 Done! All 25 QR codes saved in:\n{folder}")