# AUDIT FIXES v5.5.7 — ผลการตรวจสอบโค้ด Phaopanya_Data_Zai (V5.5.6)

ออดิทเมื่อ: 2026-09-04 | วิธี: อ่านโค้ดทุกไฟล์ (10 ไฟล์ / 6,835 บรรทัด) + ตรวจข้อมูลจริงใน XLSX 6 ไฟล์ + รันโค้ดจริงบน Node.js + GAS mock (126 tests ก่อนแก้ / 138 tests หลังแก้ — ผ่านทั้งหมด)

## สรุปผล
- ข้อมูลหลักแข็งแรง: MASTER 11,262 แถว ไม่มี MD_ID/MATCH_KEY ซ้ำ, U/V/W/X ตรงพจนานุกรม SYS_TH_GEO 100% (0/11,204 mismatch), SYS_MASTER_IDX ตรง MASTER ครบ, LAT/LNG ทุกแถวอยู่ในช่วงไทย
- พบและแก้ 4 จุด (พิสูจน์ด้วย test ที่รันได้จริง): บั๊กใหญ่สุดคือ P2 จำนวน 3 ตัว + P3-latent 1 ตัว
- ไม่พบ P0/P1 ใด ๆ

## ไฟล์ที่แก้ (4 จาก 10 — อีก 6 ไฟล์ไม่ถูกแตะ)

| ID | ระดับ | ไฟล์ | ฟังก์ชัน | ปัญหา | การแก้ |
|----|------|------|----------|-------|--------|
| FIX-1 | P2 | 06_GoogleMapsService.gs | mapsAutoSweep_ / mapsRetryMissingData | เงื่อนไข sweep พลาด addr='N/A' (เช็คเฉพาะ dist 'N/A') → แถวจริง 3 แถว addr=N/A+dist ถูกต้องไม่ถูกแก้ | เพิ่ม valAddr/addrVal === 'N/A' ใน gate 2 จุด |
| FIX-2 | P2 | 04_GeoService.gs | geoMatch_ ชั้น 8-9 | TAMBON_LEV/AMPHOE_LEV (ไทย) ไม่มี postalOk_ ตรวจรหัสขัดแย้ง ต่างจาก EN path (v5.5.3) → เสี่ยงแมชต์ตำบลคนละเขตที่ห่าง 1 ตัวอักษร | เพิ่ม postalOk_(f3, e.postal) / postalOk_(f4, e.postal) ให้ตรงนโยบาย EN |
| FIX-3 | P2 | 99_SelfTest.gs | testLatLongRange_ | หาคอลัมน์ LatLong_Actual บน MASTER ซึ่งไม่มี (อยู่บนตารางงานประจำวัน) → test ตาย ไม่เคยตรวจอะไรเลย | เปลี่ยนไปตรวจ LAT/LNG จริงบน MASTER + รองรับ boundary 1-5% = WARN / >5% = FAIL |
| FIX-4 | P3 | 01_MasterService.gs | upsertMasterIdxRows_ | sentinel -1 เป็น truthy → MD_ID ซ้ำใน batch (กรณี rebuild จาก MASTER เสียหาย) ทำให้ getRange(-1) crash เครื่องมือซ่อม | เช็ค !== undefined && > 0 — ซ้ำถูกข้าม ไม่ crash |

## หลักฐานการทดสอบ (EXECUTED บน Node.js + GAS mock — ไม่ใช่ Google จริง)
- ก่อนแก้: test C1 (Thai LEV คืนแถว 10170 ทั้งที่ข้อความระบุ 10270), H1 (LAT=45 ไม่ถูกจับ), K1 (addr N/A ไม่ถูก sweep), L1 (crash) = พิสูจน์บั๊กทั้ง 4
- หลังแก้: ทั้ง 4 จุดกลับเป็นพฤติกรรมที่ถูกต้อง + อีก 122 tests เดิมยังผ่านครบ (ไม่มี regression)
- Positive/Negative/Boundary ครบ: typo ไม่มีรหัสยังแก้ได้ / รหัสตรงยอมรับ / รหัสขัดแย้งปฏิเสธ / 1% out-of-range = WARN / 33% = FAIL

## ข้อสังเกตที่ "ไม่แก้" ตามหลัก Minimal Safe Change (รายงานไว้ให้เจ้าของระบบตัดสินใจ)
1. cleanThai ไม่ตัดคำนำหน้าที่ไม่มีเว้นวรรค ("นายสมชาย") — สอดคล้องทั้งสองฝั่ง key การแก้จะ re-key MASTER ทั้งชีต (อันตราย)
2. cleanThai strip จุด ("บ." → "บ ") — cosmetic ใน NAME_CLEAN
3. getGeoSourceIndex_ เลือกแถวล่าสุดอาจทิ้งระยะทางของแถวเก่า — MASTER.Z มี fill-don't-destroy คุ้มอยู่แล้ว (ข้อมูลจริง Z 100% เต็ม)
4. Thai path ไม่ได้ REORDER ชั้น LEV ก่อน FUZZY แบบ EN (v5.5.3) — สลับลำดับจะเปลี่ยนผลลัพธ์ 45 แถว AMPHOE_FUZZY ที่มีอยู่
5. MD_ID เกิน MD-9999 แสดง 5 หลัก (MD-10000+) — 1,263 แถว, parseMasterId_ รองรับ ไม่มีผลเชิงหน้าที่
6. FETCH_MAX_MS / MASTER_TOTAL_COLS_PHASE1/PHASE3 เป็น dead constants, comment SOURCE_IDX ระบุชนิดคอลัมน์ผิด

## ขั้นตอนถัดไปสำหรับผู้ใช้
1. Backup สคริปต์เดิม → วาง 4 ไฟล์ที่แก้แล้วทับ (01/04/06/99) — อีก 6 ไฟล์เหมือนเดิมไม่ต้องวางใหม่ก็ได้
2. รันเมนู ⚙️ Config → 📝 บันทึกประวัติแก้โค้ด: v5.5.7 | AUDIT FIX 1-4 (ตามกติกาโปรเจกต์)
3. รัน 🧪 Self-Test — testLatLongRange_ จะกลายเป็น PASS จริง (เดิม WARN ตาย)
4. (ไม่บังคับ) เมนู Maps → 🔄 ซ่อมข้อมูล 1 ครั้ง เพื่อเก็บแถว addr='N/A' ที่ค้าง
