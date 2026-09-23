# geo-learn v2 — สิ่งที่แก้จากฉบับ 05/09/2026 และวิธีใช้

## แก้อะไรบ้าง (ทำไมฉบับนี้จึง "พร้อมใช้")

1. **อ้างอิงเวอร์ชันให้ตรงของจริง:** v5.5.6 → **v5.5.7** ทุกจุด รวมผล FIX-2 ที่ทำให้ชั้น TAMBON_LEV/AMPHOE_LEV ฝั่งไทยมี `postalOk_` เท่าฝั่ง EN — กระทบโดยตรงต่อการออกแบบตำแหน่งชั้น LEARN ใน G06
2. **ถอดชื่อ skill ที่ไม่มีอยู่จริง** (`phaopanya-production-engineer` / `grill-me` / `thai-logistics-geocoder`) → แทนด้วยวิธีทำงานจริง: คุยกับ **Super Z ในแชท** (grilling = ถาม–ตอบกับผู้ใช้โดยตรง · ตรวจโค้ด = อ่าน repo/XLSX จริงได้ทันที)
3. **แก้ลิงก์ Decision ที่พัง** (เดิมชี้ `.`) → สร้างไฟล์ `decisions/D01-separate-learn-table.md` ให้ย้อนกลับดูเหตุผลได้จริง
4. **ฉีดสถานะงานจริงเข้า context ทุก ticket:** MANUAL 73 แถว (15 + 58) · 06 ถอด SPREADSHEET_ID วางแล้ว · repo push v5.5.7 แล้ว · 4 แถว FULL_AREA วังทองหลาง 10310 รอวาง (แทรกเหนือแถว 153) · ตัวอย่างขยะจริง: Y="65000" (MD-9576), GeoErr 8 แถว, addr N/A 3 แถว, สะกด Phlabphla ≠ Phlapphla 7 แถว
5. **เพิ่มกติกาปิด ticket สำหรับ tracker ท้องถิ่น:** แนบ `## Resolution` ท้ายไฟล์ → `Status: closed` → ย้ายบรรทัดเข้า "Decisions so far" ใน MAP — ทำได้จริงโดยไม่ต้องมี GitHub Issues
6. **แผน T (Runtime Proof) แยกทางอย่างเป็นทางการ:** รวมเข้า STABILITY_PLAN / คิว deploy ขั้น 1–6 แล้ว — แผน G ยืนอิสระ เริ่มได้เลยไม่ต้องรอ

โครงสร้าง ticket ทั้ง 10 ใบ ชื่อ ลำดับ และความสัมพันธ์ blocking (G01→…→G10) **คงเดิมทั้งหมด** — v2 ไม่เปลี่ยนเจตนาเดิมของแผน แค่ทำให้ข้อมูลทุกใบตรงความจริงปัจจุบัน

## วิธีใช้

1. แตก zip แล้ววางโฟลเดอร์ `geo-learn/` ที่ `Other/wayfinder/geo-learn/` ใน repo Phaopanya_Data_Zai หรือ `artifacts/wayfinder/geo-learn/` ในเครื่อง
2. เริ่มรอบแรก: พิมพ์ในแชท **claim G01 Lock SYS_GEO_LEARN column schema**
3. จบใบจริง ค่อยใบต่อไป (หนึ่ง ticket ต่อรอบ) — G10 คือสเปกส่งต่อการ implement

## ลำดับ ticket (สรุป)

- **เริ่มได้ทันที:** G01 (schema) · G02 (คีย์เรียน) · G03 (ค่า output)
- **รอผล:** G04 → G05 → G06 → G07 / G08 / G09 → G10 (สเปกส่งต่อ)
