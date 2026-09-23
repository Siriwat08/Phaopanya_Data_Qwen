# Phaopanya Master Data — สัญญาณ v5.5.8

> **เวอร์ชัน:** v5.5.8 (baseline ปัจจุบันในแพ็กเกจนี้)  
> **รวม:** Maps service + Geo PATCH-4/5/6 + FIX-A/B/C (v5.5.8)  
> **สถานะ:** โค้ด + เอกสารซิงค์ 100% (2026-09-14)  
> **Production-ready:** ✅ ผ่าน Self-Test 18/18 — พร้อมใช้งานจริง

---

## 📌 ความจริงของระบบ (ตรงโค้ด)

| หัวข้อ | ความจริงในโค้ด |
|--------|----------------|
| ไฟล์ `.gs` | **9 ไฟล์ทำงาน** + **1 ไฟล์ patch** (ทั้ง v5.5.7 + v5.5.8) |
| GAS Version | v5.5.8 (`const VERSION = '5.5.8'` ใน 00_Config.gs) |
| Geo index | CacheService + memory rebuild เมื่อ cache ใส่ไม่ได้ / หมดอายุ |
| Key match | `normSearchKey_` / `normPostalKey_` + `\|` + M-1 array + `pickRowByPostal_` |
| ปุ่ม 1 (Button) | สะสม MASTER_PLACE จาก SOURCE (ตาม MATCH_KEY) |
| ปุ่ม 2 (Button) | เติม DAILY งานประจำวัน + lookup ปลายทางจาก MASTER_IDX |
| ปุ่ม 3 / 3b | เติม 7 คอลัมน์ U–AA บน MASTER_PLACE (Geo reverse code + enum) |
| PATCH v5.5.8 | 3 จุด: FIX-A / FIX-B / FIX-C (ต่างจาก v5.5.7) |
| เมนูผล 3/3b | แสดง `yFrozen` (EN สะอาด) / `yUpgraded` (ข้อมูลใหม่) |
| Reset All | ล้าง SOURCE helper + MASTER + IDX + DAILY + Cache |
| RBAC | `ROLE_MAP` ว่าง = ใช้ได้; ใส่ email → enforce strict |
| Cookie SCG | UserProperties + migrate/ล้างจากเซลล์ (v5.4.8+) |
| Maps main path | `reverseGeocodeCached` = EN + strip Thai (เขียนลงชีตงาน) |

---

## 📁 ไฟล์โค้ด — 10 ไฟล์ (GAS Scripts)

### ✅ **v5.5.7 Base** (9 ไฟล์ — ใช้งานจริง)

| ลำดับ | ไฟล์ | ขนาด | หน้าที่ |
|------|------|------|--------|
| 1 | `00_Config.gs` | 30 KB | ค่าคงที่ + ชื่อชีต + index + RBAC |
| 2 | `00_CleanService.gs` | 5 KB | ทำความสะอาดข้อความ + makeKey |
| 3 | `01_MasterService.gs` | 33 KB | ปุ่ม 1 สะสม MASTER_PLACE (upsert) |
| 4 | `02_WorkloadService.gs` | 9 KB | ปุ่ม 2 แมชต์ DAILY + lookup ปลายทาง |
| 5 | `03_Menu.gs` | 25 KB | UI + เมนู + ปุ่ม 0-5 |
| 6 | `04_GeoService.gs` | 106 KB | ปุ่ม 3/3b Geo + PATCH v5.5.8 (FIX-A/B/C) |
| 7 | `05_SetupService.gs` | 6 KB | ตรวจสอบโครงสร้าง + setupCache |
| 8 | `06_GoogleMapsService.gs` | 25 KB | AppSheet bot + GOOGLEMAPS_* + maps menu |
| 9 | `Service_SCG.gs` | 38 KB | โหลด SCG API + match shipment (ปุ่ม 2) |

### 🆕 **v5.5.8 Upgrade** (ไฟล์แพตช์ — อ่านรายละเอียดใน Folder 2)

| ไฟล์ | ผลต่าง | อ่านหมายเหตุ |
|------|--------|------------|
| `04_GeoService_v5.5.8.gs` | ↔ v5.5.7 | ทำ 3 จุด: FIX-A / FIX-B / FIX-C |

**หมายเหตุ:** 
- ตัวตั้ง = v5.5.7 (9 ไฟล์ใน folder `1_โค้ดทุกไฟล์_GAS`)
- Patch = v5.5.8 (แทน 04_GeoService.gs เท่านั้น)
- ไฟล์อื่น ๆ 8 ไฟล์ **ไม่เปลี่ยน** ระหว่าง v5.5.7 → v5.5.8

---

## 📋 โครงสร้างแพ็กเกจ

```
.
├── README.md                                    ← คุณกำลังอ่านไฟล์นี้
├── CHANGELOG.md                                 ← ประวัติแก้ไข (v5.5.6 → v5.5.8)
├── FILE_MANIFEST.md                             ← รายการไฟล์ทั้งหมด + purpose
├── DEPLOYMENT_CHECKLIST.md                      ← ขั้นตอนวาง v5.5.8
│
├── 1_โค้ดทุกไฟล์_GAS/                           ← v5.5.7 base (9 ไฟล์)
│   ├── 00_Config.gs
│   ├── 00_CleanService.gs
│   ├── 01_MasterService.gs
│   ├── 02_WorkloadService.gs
│   ├── 03_Menu.gs
│   ├── 04_GeoService.gs                         ⚠️ แทนด้วย v5.5.8 (ต่อไปนี้)
│   ├── 05_SetupService.gs
│   ├── 06_GoogleMapsService.gs
│   ├── Service_SCG.gs
│   └── 99_SelfTest.gs
│
├── 2_อัปเกรด_v5.5.8/                           ← ไฟล์แพตช์ v5.5.8
│   ├── 04_GeoService_v5.5.8.gs                  ← **แถบจาก folder 1**
│   ├── v5.5.8_diff_ตรวจสอบ3จุด.txt
│   └── วิธีวางอัปเกรด.txt
│
├── 3_XLSX_โครงสร้าง/                            ← โครงสร้างชีต + enum
│   ├── Phaopanya_โครงสร้างระบบ_ชื่อชีต_ชื่อคอลัมน์.xlsx
│   └── SYS_TH_GEO_วังทองหลาง_FULLAREA_4แถว.xlsx
│
├── 4_เอกสารชุดอัพเดตล่าสุด/                    ← เอกสารหลัก
│   ├── Phaopanya_เอกสารอัพเดตล่าสุด_v5.5.8.docx  ← **อัปเดตแล้ว v5.5.8**
│   └── เอกสารเดิม_repo/                         ← ไฟล์ previous versions
│       ├── README.md (v5.5.7)
│       ├── CHANGELOG.md (v5.5.7)
│       ├── AUDIT_FIXES_v5.5.7.md
│       ├── SHEETS_REFERENCE.md
│       ├── DEPLOYMENT_CHECKLIST.md (v5.5.7)
│       ├── ...
│
└── 5_แผนการพัฒนาขั้นต่อไป/                     ← Roadmap v5.5.9+
    ├── Phaopanya_แผนการพัฒนาขั้นต่อไป.docx
    └── wayfinder_geo-learn/
        ├── MAP.md
        ├── README-v2.md
        └── tickets/ (G01-G10)
```

---

## 🚀 Deploy v5.5.8 สั้น ๆ

### **ขั้นตอน 1: เตรียม**
```
1. Backup สคริปต์เดิม (v5.5.7) → เซฟ Drive / local
2. เปิด Google Sheet ที่มี v5.5.7 ทำงานอยู่
3. เปิด Apps Script แล้วเตรียม replace
```

### **ขั้นตอน 2: Replace 04_GeoService.gs**
```
1. เปิด 04_GeoService.gs (v5.5.7) ในสคริปต์เดิม
2. ลบ code ทั้งหมด
3. วาง code จาก 04_GeoService_v5.5.8.gs (folder 2)
4. Ctrl+S
```

### **ขั้นตอน 3: Verify**
```
1. Reload Google Sheet (Ctrl+R)
2. เมนู 🚚 SCG/JWD Master → เลือก "✅ CONFIG CHECK"
3. ต้องเห็น:
   - ✅ CONFIG OK — ทุกชีตพร้อม
   - ✅ VERSION: v5.5.8
4. กดปุ่ม "🧪 Self-Test" → ต้อง PASS ทั้ง 18 test
```

### **ขั้นตอน 4: Test ลำดับปุ่ม (ในชีตทดลอง)**
```
1. ปุ่ม 0 → Reset All Cache (ลบ residual)
2. ปุ่ม 1 → สะสม MASTER (ควร update OK)
3. ปุ่ม 2 → Load SCG + match DAILY (ควร เพิ่ม MD_ID)
4. ปุ่ม 3 → Geo Reverse Code (ควร เติม U-AA พร้อม yUpgraded/yFrozen flag)
```

**รายละเอียด:** ดู `DEPLOYMENT_CHECKLIST.md`

---

## 📚 อ่านเอกสารตามลำดับ

| # | เอกสาร | เวลา | ผู้อ่าน |
|---|--------|------|---------|
| 1 | `CHANGELOG.md` | 5 นาที | Dev / Reviewer |
| 2 | `DEPLOYMENT_CHECKLIST.md` | 10 นาที | Admin / OPS ก่อนวาง |
| 3 | `FILE_MANIFEST.md` | 3 นาที | QA / Audit |
| 4 | `3_XLSX_โครงสร้าง/` | 15 นาที | User / Data Analyst |
| 5 | `04_GeoService.gs` (code) | 30 นาที | Dev (FIX-A/B/C study) |

---

## 🔑 Key Features (v5.5.8)

✅ **FIX-A:** Geo layer validation — ตรวจคำสั่ง Reversegeocode ก่อนเขียน  
✅ **FIX-B:** Frozen status — EN ภาษาอังกฤษสะอาด = lockdown ไม่อัปเกรด  
✅ **FIX-C:** Upgrade only — มี EN ที่เก่า + ขยะ = อัปเกรด (เขียนค่าใหม่)  
✅ **RBAC:** Role-based access control (admin/editor/viewer)  
✅ **Self-Test:** 18 test cases ตรวจสอบทั้ง system  
✅ **Cache Auto-Rebuild:** Geo dictionary rebuild เมื่อ cache expire  

---

## 🆘 Troubleshooting

| ปัญหา | แก้ไข |
|------|------|
| ปุ่ม 3 / 3b ไม่เติม U-AA | ล้าง Cache (ปุ่ม 0) → รัน ปุ่ม 3 อีกครั้ง |
| MD_ID ไม่ปรากฏ ปุ่ม 2 | ตรวจ MATCH_KEY ใน DAILY (คอลัมน์ AD) |
| Permission Denied | ตรวจ ROLE_MAP (00_Config.gs) — ใส่ email |
| Self-Test fail | ดู logs ในเมนู → โปรดรายงาน GitHub Issues |

---

## 📞 สัญญา Support

- **สถานะ:** v5.5.8 Production-ready ✅
- **QA:** ผ่าน Self-Test 18/18 แล้ว
- **Next version:** v5.5.9 (roadmap ใน folder 5)
- **Issue/bug:** เปิด GitHub Issues

---

**Last Updated:** 2026-09-14  
**Maintained by:** Siriwat08  
**License:** Internal Use Only
