# 📋 DEPLOYMENT CHECKLIST — Phaopanya Master v5.5.6

> **สำหรับ:** ทีมที่ Deploy v5.5.6
> **ไฟล์โค้ด:** 10 ไฟล์ `.gs` (รวม 06_GoogleMapsService.gs)
> **เอกสารซิงค์โค้ด:** 2026-09-03
> **วันที่:** 2026-08-26
> **ผู้รับผิดชอบ:** [ชื่อผู้ deploy]

---

## ✅ PRE-DEPLOY (ก่อน Deploy)

### 1. Backup
- [ ] Backup Apps Script project เดิม (Overview → 📋 Make a copy)
- [ ] Backup Sheet ทั้ง Workbook (File → Make a copy)
- [ ] เก็บ backup ใน Drive folder แยก (`/Backup/v5.5.x/`)
- [ ] บันทึก version ก่อน deploy ใน `PENDING_FIXES.md`

### 2. Verify package
- [ ] Download `Phaopanya_Master_v5.5.6_COMPLETE.zip` (จาก deliver)
- [ ] Extract ดูว่ามี **9 .gs + 9 .md = 18 ไฟล์**
- [ ] เปิด `README.md` ตรวจ "v5.5.6"
- [ ] เปิด `CHANGELOG.md` ตรวจ v5.5.6 entry
- [ ] เปิด `DEPLOYMENT_CHECKLIST.md` (นี่คือไฟล์นี้)

### 3. Compare versions
- [ ] เปิด Apps Script editor
- [ ] ดูว่า version ปัจจุบันคือ v5.4.x
- [ ] ตรวจสอบไฟล์เดิมที่จะถูกแทน — ต้องวางทับให้ครบ 10 ไฟล์ (00–05 + 06_GoogleMapsService + Service_SCG + 99_SelfTest)

---

## 🚀 DEPLOY (Deploy จริง)

### 4. Replace files
- [ ] Apps Script editor → แต่ละไฟล์ → ⋮ → Replace with → paste เนื้อหาใหม่
  - 00_CleanService.gs (76 บรรทัด)
  - 00_Config.gs (592)
  - 01_MasterService.gs (622)
  - 02_WorkloadService.gs (173)
  - 03_Menu.gs (361)
  - 04_GeoService.gs (1,513)
  - 05_SetupService.gs (132)
  - 99_SelfTest.gs (634)
  - Service_SCG.gs (837)
- [ ] ไฟล์ใหม่ `99_SelfTest.gs` (ถ้ายังไม่มี) → กด + → Script → ตั้งชื่อ "99_SelfTest" → paste
- [ ] Save (Ctrl+S) ทุกไฟล์
- [ ] ตรวจ "Project saved successfully"

### 5. Reload Sheet
- [ ] กลับไปที่ Sheet tab
- [ ] กด Reload (F5)
- [ ] รอ 2-3 วินาที
- [ ] ตรวจเมนู "🚚 SCG/JWD Master" ยังอยู่
- [ ] ตรวจเมนู "ดูผล / รีเซ็ต" มี "🧪 Self-Test (เช็คระบบ 8 จุด)"
- [ ] ตรวจเมนู "🔐 Security & Maintenance" มี "🔑 ตั้ง / เปลี่ยน SCG Cookie" + "🛡️ Trim PII (ลบ เลขบัตร/เบอร์โทร)"
- [ ] ตรวจเมนู "ดูผล / รีเซ็ต" มี "🗑️ Reset All Master Refs (ล้าง MASTER + IDX + DAILY)"

### 6. Authorize (ถ้ามี scopes ใหม่)
- [ ] ถ้า Apps Script ถาม authorize → กด "Review Permissions"
- [ ] Login Google account
- [ ] กด "Allow"

---

## 🧪 POST-DEPLOY VERIFICATION (ตรวจหลัง Deploy)

### 7. Run Self-Test (สำคัญที่สุด)
- [ ] เมนู **ดูผล / รีเซ็ต → 🧪 Self-Test (เช็คระบบ 8 จุด)**
- [ ] ต้องเห็น dialog HTML แสดงผล
- [ ] ตรวจผลแต่ละข้อ:

| Test | ต้องเป็น | หมายเหตุ |
|------|---------|----------|
| 1. testKeyAlignment_ | PASS หรือ WARN | `pipe=... space=0` |
| 2. testCacheState_ | PASS หรือ WARN (cold start) | ขนาด < 90KB |
| 3. testMasterIdUniqueness_ | PASS | ไม่มี MD_ID ซ้ำ |
| 4. testHelperSchema_ | PASS | 4 + 7 cols contiguous |
| 5. testPostalCoverage_ | PASS | coverage ≥ 50% |
| 6. testLatLongRange_ | PASS หรือ WARN | out-of-range < 5% |
| 7. testPiiColumns_ | PASS หรือ WARN | แจ้งเตือนถ้ามี PII |
| 8. testRbacConfig_ | PASS | assertRole_ ทำงานได้ |

- [ ] **จำนวน PASS ≥ 6, FAIL = 0** (WARN allowed)
- [ ] **ถ้า FAIL → หยุด → แจ้งทีม** (อย่า deploy ต่อ)
- [ ] ดูผลในชีต "การตั้งค่า" (overwrite A1) — verify ตาราง

### 8. Smoke Test — Pipeline
- [ ] **ปุ่ม 0) ตรวจสอบโครงสร้าง** → ทุกชีต ✅
- [ ] **ปุ่ม 1) สะสมฐาน MASTER** → processed > 0
- [ ] **ปุ่ม 3) เติม 7 คอลัมน์ราชการ (Geo)** → filled > 0
- [ ] **ปุ่ม 3b) เติม 7 คอลัมน์ราชการ (English)** → filled > 0
- [ ] **ปุ่ม 2) รันแมชต์งานวันนี้** → FOUND/REVIEW ตามปกติ

### 9. Cookie Migration (ถ้าเคยใช้ SCG API)
- [ ] เปิดชีต "Input" → ดูว่า B1 มีค่า cookie อยู่ไหม
- [ ] ถ้ามี → เมนู **🔐 Security & Maintenance → 🔑 ตั้ง / เปลี่ยน SCG Cookie**
- [ ] ตรวจ popup แสดง "สถานะ: มี cookie แล้ว (XXX ตัวอักษร)"
- [ ] วาง cookie เดิม (copy จาก B1) → OK
- [ ] ตรวจ "✅ บันทึก SCG Cookie แล้ว"
- [ ] กลับชีต "Input" → ตรวจ B1 ว่าง (ถูกล้างอัตโนมัติ)
- [ ] ทดสอบ **📥 โหลดข้อมูลจาก API (Shipment → ตารางงานประจำวัน)** → ทำงานได้

### 10. RBAC Test (optional — ถ้าต้องการ enforce)
- [ ] เปิด `00_Config.gs` → หา `ROLE_MAP` → เพิ่ม email admin/editor
- [ ] Save → Reload
- [ ] ทดสอบกดเมนู "🗑️ Reset All Master Refs" ด้วย email ที่ไม่อยู่ใน list
- [ ] ต้องเห็น "❌ Permission denied: requires editor"
- [ ] ทดสอบด้วย email ที่อยู่ใน editor list → ต้องทำงานได้

---

## 📊 FINAL CHECK

### 11. Confirm working
- [ ] Self-Test ผ่าน 8 จุด (≥6 PASS, 0 FAIL)
- [ ] ปุ่ม 0, 1, 2, 3, 3b ทำงาน
- [ ] เมนูใหม่ครบ 4 ตัว
- [ ] Cookie migrate แล้ว (ถ้าใช้ SCG)
- [ ] RBAC enforce แล้ว (ถ้าต้องการ)

### 12. Document
- [ ] บันทึก deploy ใน Phaopanya_CodeChangelog.txt
- [ ] แจ้งทีมในแชท "v5.5.6 deployed"
- [ ] เก็บ backup ไว้ใน Drive

### 13. Monitor 24h
- [ ] ตรวจ Settings sheet → ดู error log
- [ ] ตรวจ Self-Test 1 ครั้ง (เช้าวันถัดไป) → ต้อง PASS
- [ ] ถ้ามี FAIL → rollback ตาม backup

---

## 🚨 ROLLBACK (ถ้ามีปัญหา)

### Rollback steps
- [ ] Apps Script editor → Overview → Restore from backup (เลือก backup ก่อนอัปเกรด)
- [ ] หรือ restore Sheet จาก backup
- [ ] แจ้งทีม
- [ ] วิเคราะห์ root cause ก่อน deploy ใหม่

---

## 📞 ติดต่อ

- **ผู้ deploy:** [ชื่อ]
- **ผู้พัฒนา:** Mavis (Coder agent)
- **เอกสารอ้างอิง:** `CHANGELOG.md`, `STABILITY_PLAN.md`, `FILE_CHECKLIST.md`

---

**หมายเหตุ:** แพ็กเกจปัจจุบันคือ v5.5.6 — ดู `PENDING_FIXES.md` และ `README.md` (ตารางเทียบ 7 zip) สำหรับรายละเอียดทั้งหมด
