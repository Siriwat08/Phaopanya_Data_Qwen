# Blueprint — Phaopanya Master Data

> **สถาปัตยกรรมระบบ + หลักการออกแบบ**  
> **เวอร์ชัน:** v5.5.6  
> **อัปเดตล่าสุด:** 2026-09-03 (ซิงค์เอกสารกับโค้ด)  
> **สถานะ:** พร้อมใช้งาน — ดู CHANGELOG / STABILITY_PLAN / SHEETS_REFERENCE สำหรับรายละเอียด

---

## 1. ภาพรวมสถาปัตยกรรม

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: UI / Menu (03_Menu.gs)                            │
│  ├── 🚚 SCG/JWD Master  (ปุ่ม 0,1,2,3,1+3, รีเซ็ต, ดัชนี)   │
│  ├── 📦 โหลดข้อมูล SCG  (API + Summary + Clear)             │
│  └── ⚙️ Config          (validate + บันทึกประวัติโค้ด)      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Config (00_Config.gs)                    │
│  ├── SHEETS.*    = ชื่อ 10 ชีต (รวม SYS_MASTER_IDX)         │
│  ├── MASTER_IDX.* = index 27 คอลัมน์ของ MASTER_PLACE        │
│  ├── DATA_IDX.*  = index 32 คอลัมน์ของ "ตารางงานประจำวัน"  │
│  ├── MASTER_IDX_SHEET = ดัชนีเบา 5 คอลัมน์สำหรับปุ่ม 2     │
│  ├── GEO_DICT_IDX.*, SOURCE_IDX.* ฯลฯ                       │
│  └── validateConfig_() / validateSCGConfig_()              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1b: Services                                         │
│  ├── 00_CleanService: makeKey / cleanName / cleanAddr       │
│  ├── 01_MasterService: สะสม MASTER_PLACE + upsert ดัชนี     │
│  ├── 02_WorkloadService: แมชต์งานประจำวัน (อ่านดัชนี)      │
│  ├── 04_GeoService: แมชต์ภูมิศาสตร์ (7 คอลัมน์ U–AA)       │
│  ├── 05_SetupService: audit โครงสร้าง (ไม่แก้หัวคอลัมน์)    │
│  └── Service_SCG: โหลด API + Aggregate + Summary            │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Google Sheets (10 ชีต)                            │
│  ดู SHEETS_REFERENCE.md สำหรับ schema ครบทุกชีต             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. โฟลว์หลัก

### Flow A: สะสม MASTER (ปุ่ม 1)

```
SCGนครหลวงJWDภูมิภาค (source)
        ↓
  makeKey(ชื่อ, ที่อยู่, เจ้าของ)
        ↓
  เทียบ MASTER_PLACE (exact3 + alias3)
        ↓
  NEW → สร้าง MD-xxxx / UPDATE → POINTS + LAST_SEEN
        ↓
  เขียน helper บน source (MD_LINK, MATCH_KEY, POINTS, STATUS)
  เขียน MASTER คอลัมน์ A–T (20 คอลัมน์)
        ↓
  upsert SYS_MASTER_IDX ตาม MD_ID  (ไม่ลบทั้งชีต)
```

**การป้องกัน**

- LockService
- TIME_GUARD (~5 นาที)
- partial-write ทุก 200 แถว + flush ท้ายรอบ
- ข้ามแถวที่มี MD_LINK + MATCH_KEY แล้ว
- LAST_SEEN กัน POINTS inflation วันเดียวกัน

### Flow A2: Master Index

```
ปุ่ม 1 runMaster() เสร็จ (NEW/UPDATE)
        ↓
  upsert SYS_MASTER_IDX ตาม MD_ID
  (อัปเดตแถวเดิม หรือ append — ไม่ลบทั้งชีต)
        ↓
ปุ่ม 2 runDailyMatch()
        ↓
  อ่าน SYS_MASTER_IDX → map3/map3a
  ถ้าว่าง → fallback โหลด MASTER_PLACE ทั้งแผ่น
```

**เมนูซ่อมครั้งแรก:**  
`ดูผล / รีเซ็ต → ซ่อมดัชนี SYS_MASTER_IDX จาก MASTER`

### Flow B: Geo Matching (ปุ่ม 3, 3b)

```
MASTER_PLACE (ที่มีแถวแล้ว)
        ↓
  ต้นทาง geo จาก SOURCE (ชื่อที่อยู่จาก_LatLong + ระยะทาง)
        ↓
  geoParse_ → เทียบ SYS_TH_GEO (cache TH/EN)
        ↓
  เขียนเฉพาะ U–AA (7 คอลัมน์) — ไม่แตะ A–T / P–Q
```

**ชั้นแมชต์ (เร็ว → ช้า)**

1. Exact (postal / search_key)
2. Province / amphoe scan
3. Fuzzy bigram ≥ 0.80 (pool ต่อจังหวัด)
4. Levenshtein ≤ 1

`CHECK_NOTE` ในพจนานุกรม → **ไม่เติมอัตโนมัติ**

### Flow C: แมชต์งานประจำวัน (ปุ่ม 2)

```
ตารางงานประจำวัน
        ↓
  MATCH_KEY จากตอนโหลด SCG (หรือ makeKey ถ้าว่าง)
        ↓
  lookup map3 / map3a จาก SYS_MASTER_IDX (หรือ MASTER)
        ↓
  FOUND → เขียน LatLong_Actual, MD_ID, Status
  REVIEW → คงค่าเดิม (BUG-007 ไม่ทับด้วยช่องว่าง)
```

**ปุ่ม 2 ไม่เขียนลง MASTER_PLACE**

### Flow D: โหลด SCG API

```
Input (Cookie + Shipment list)
        ↓
  fetch API → แปลง → ตารางงานประจำวัน (32 cols)
        ↓
  สร้าง MATCH_KEY ด้วย makeKey ชุดเดียวกับปุ่ม 1
  เว้น LatLong_Actual / MD_ID / Status ไว้ให้ปุ่ม 2
        ↓
  Aggregate + สร้างสรุป_เจ้าของสินค้า / สรุป_Shipment
```

---

## 3. หลักการออกแบบ (ทำไมทำแบบนี้)

### 1. Central Config (`SHEETS.*` + `*_IDX`)

- เปลี่ยนชื่อชีตที่เดียวจบ
- Index เป็น default สำหรับเอกสาร / validate
- ชีต SOURCE / DAILY / MASTER ใช้ **dynamic header** เป็นหลัก (ผู้ใช้อาจแทรกคอลัมน์)

### 2. แยกคอลัมน์ปุ่ม 1 กับปุ่ม 3 บน MASTER

| ช่วง | เจ้าของ | เนื้อหา |
|------|---------|---------|
| A–T (20) | ปุ่ม 1 | MD_ID, MATCH_KEY, พิกัด, POINTS, PROVINCE/AMPHOE, P/Q |
| U–AA (7) | ปุ่ม 3 | รหัสไปรษณีย์ + จว./อภ./ตบ. + GEO_LAYER |

→ **ปุ่ม 3 ไม่ทับข้อมูลปุ่ม 1**

### 3. MATCH_KEY ชุดเดียว

- `makeKey` / `makeKeyAlias` อยู่ที่ `00_CleanService.gs` เท่านั้น
- SCG โหลด / ปุ่ม 1 / ปุ่ม 2 ใช้สูตรเดียวกัน → lookup ตรงกัน

### 4. ไม่แก้หัวคอลัมน์อัตโนมัติ

- `05_SetupService` และ `validateConfig_` = **audit อย่างเดียว**
- หัวคอลัมน์เป็นของข้อมูลผู้ใช้ — ระบบไม่สร้าง/ไม่เปลี่ยน/ไม่ลบ

### 5. ดัชนีเบาแทน cache TTL

- CacheService จำกัดขนาด + หมดอายุไม่แน่นอน
- `SYS_MASTER_IDX` อยู่จนกว่าปุ่ม 1 จะอัปเดต — **upsert ตาม MD_ID ไม่ลบทั้งชีต**

---

## 4. ไฟล์ในแพ็กเกจ

| ไฟล์ | บทบาท |
|------|--------|
| `00_Config.gs` | ชื่อชีต + index + ค่าคงที่ |
| `00_CleanService.gs` | clean / makeKey |
| `01_MasterService.gs` | ปุ่ม 1 + ดัชนี |
| `02_WorkloadService.gs` | ปุ่ม 2 |
| `03_Menu.gs` | เมนูทั้งหมด |
| `04_GeoService.gs` | ปุ่ม 3 / 3b |
| `05_SetupService.gs` | ตรวจสอบโครงสร้าง |
| `Service_SCG.gs` | โหลด API + สรุป |
| `SHEETS_REFERENCE.md` | Schema ทุกชีต |
| `CHANGELOG.md` | ประวัติเวอร์ชัน |
| `PENDING_FIXES.md` | ข้อจำกัดที่รู้จัก |
| `README.md` | คู่มือเริ่มต้น |
| `Blueprint.md` | เอกสารนี้ |
| `CHECKLIST.md` | รายการตรวจ |

---

## 5. ประสิทธิภาพโดยประมาณ

| งาน | ข้อมูล | เวลาโดยประมาณ | หมายเหตุ |
|-----|--------|----------------|----------|
| ปุ่ม 1 | source หลายร้อยแถว | ขึ้นกับ geoParse_ + flush | TIME_GUARD 5 นาที |
| ปุ่ม 2 + ดัชนี | daily หลายร้อยแถว | เร็ว (อ่าน 5 cols) | ถ้าว่าง fallback MASTER |
| ปุ่ม 3 | MASTER 1,000 แถว | batch 500 + cache | Fuzzy จังหวัดใหญ่ช้าได้ |
| Cache SYS_TH_GEO | 7,537 × 32 | first load นาน / hit เร็ว | TTL ~6 ชม. |

---

## 6. สิ่งที่ตั้งใจไม่ทำ (ข้อจำกัดที่รู้จัก)

1. **Fuzzy/Lev จังหวัดใหญ่** — linear scan เมื่อ exact ไม่เจอ (ไม่ใช่บั๊ก)
2. **cleanAddr / บริษัท-บจก.** — ไม่เปลี่ยนสูตร MATCH_KEY เดิม
3. **validateConfig_** ไม่เทียบ header ลึก — Setup ทำส่วนนี้แทน
4. **ไม่ลบแถวดัชนีที่ orphan** — upsert อย่างเดียวเพื่อความปลอดภัยข้อมูล

---

## 7. ขั้นตอน deploy (อ้างอิง — ใช้ INSTALL / DEPLOYMENT_CHECKLIST ของ v5.5.6)

1. คัดลอกไฟล์ `.gs` ทั้งหมดขึ้น Apps Script → Save  
2. Refresh ชีต Google Sheet  
3. รัน **0) ตรวจสอบโครงสร้าง**  
4. รัน **ซ่อมดัชนี SYS_MASTER_IDX จาก MASTER** หนึ่งครั้ง  
5. ทดสอบปุ่ม 1 → 2 → 3 บนข้อมูลชุดเล็ก  

---

## 8. เอกสารอ้างอิง

| ต้องการ | เปิดไฟล์ |
|---------|----------|
| Schema ทุกชีต / คอลัมน์ | `SHEETS_REFERENCE.md` |
| ประวัติแก้โค้ด | `CHANGELOG.md` |
| ข้อค้าง / ข้อจำกัด | `PENDING_FIXES.md` |
| วิธีเริ่มใช้ | `README.md` |
| รายการตรวจยืนยัน | `CHECKLIST.md` |

---

*เอกสารซิงค์กับโค้ดแพ็กเกจ v5.5.6*


---

## บันทึกซิงค์ v5.5.6

- ไฟล์โค้ดในโปรเจกต์: 10 ไฟล์ รวม `06_GoogleMapsService.gs`
- ปุ่ม 3/3b: เขียน U–AA; PATCH-6 ควบคุมการทับ `Reversegeocode` (Y) แบบ Upgrade-only
- รายละเอียดคอลัมน์ล่าสุด: ดู `SHEETS_REFERENCE.md` + `00_Config.gs`
