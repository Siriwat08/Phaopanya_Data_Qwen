# SHEETS_REFERENCE — Phaopanya Master Data

> **Schema ครบทุกชีต + index คอลัมน์ (_IDX)**  
> **เวอร์ชัน:** v5.5.6  
> **อัปเดตล่าสุด:** 2026-09-03 (ซิงค์เอกสารกับโค้ด)  
> **Source of truth:** `00_Config.gs` (`SHEETS`, `SHEET_INFO`, `*_IDX`)

---

## 📋 สรุปชีตทั้ง 10

| # | ชื่อชีต | แถวโดยประมาณ | คอลัมน์ | หน้าที่ | ใช้โดย |
|---|---------|-------------|---------|---------|--------|
| 1 | **SCGนครหลวงJWDภูมิภาค** | ~2,000 | 41 | ต้นทาง Appsheet (ฟอร์มคนขับ) | ปุ่ม 1 |
| 2 | **ตารางงานประจำวัน** | แปรผัน | 32 | งานประจำวัน (โหลด API / แมชต์) | SCG โหลด, ปุ่ม 2 |
| 3 | **MASTER_PLACE** | ~1,000+ | 27 | ฐานข้อมูลสถานที่มาตรฐาน | ปุ่ม 1, 2, 3 |
| 4 | **การตั้งค่า** | แปรผัน | 3–6 | Log การรันระบบ | ทุกปุ่ม (log) |
| 5 | **SYS_TH_GEO** | ~7,538 | 32 | พจนานุกรม จว./อภ./ตบ. (TH+EN) | ปุ่ม 1, 3 |
| 6 | **สรุป_เจ้าของสินค้า** | แปรผัน | 6 | สรุปตาม SoldToName | Service_SCG |
| 7 | **สรุป_Shipment** | แปรผัน | 7 | สรุปตาม Shipment No | Service_SCG |
| 8 | **Input** | แปรผัน | 2 | Cookie + รายการ Shipment | Service_SCG |
| 9 | **ข้อมูลพนักงาน** | ~24 | 8 | รายชื่อ + Email + บทบาท (RBAC) | Service_SCG |
| 10 | **SYS_MASTER_IDX** | ~1,000+ | 5 | ดัชนีเบา MATCH_KEY→MD_ID/LAT/LNG | ปุ่ม 1 เขียน, ปุ่ม 2 อ่าน |

---

## 📊 ชีต #1: `SCGนครหลวงJWDภูมิภาค` (SOURCE)

**หน้าที่:** ข้อมูลดิบจาก Appsheet (คนขับบันทึก) → ปุ่ม 1 ใช้สะสม MASTER

| Index | Col | Header (สำคัญ) | หมายเหตุ |
|------|-----|----------------|----------|
| 0 | A | (หัว) | |
| 1 | B | ID_SCG… | |
| 4 | E | จุดส่งสินค้าปลายทาง / เกี่ยวข้องชื่อ | dynamic header |
| 14 | O | **LAT** | จำเป็นต่อปุ่ม 1 |
| 15 | P | **LONG** | จำเป็นต่อปุ่ม 1 |
| 23 | X | ระยะทางจากคลัง_Km | ใช้ปุ่ม 3 (ต้นทาง geo) |
| 24 | Y | ชื่อที่อยู่จาก_LatLong | ใช้ปุ่ม 3 (ต้นทาง geo) |
| 37 | AL | **MD_LINK** | ปุ่ม 1 เขียน |
| 38 | AM | **MATCH_KEY** | ปุ่ม 1 เขียน |
| 39 | AN | **POINTS_AT_TIME** | ปุ่ม 1 เขียน |
| 40 | AO | **STATUS** | ปุ่ม 1 เขียน |

**คอลัมน์ที่โค้ด require (dynamic header):**  
`ชื่อปลายทาง`, `ที่อยู่ปลายทาง`, `ชื่อเจ้าของสินค้า`, `LAT`, `LONG`, `MD_LINK`, `MATCH_KEY`, `POINTS_AT_TIME`, `STATUS`

> หมายเหตุ: ชีตนี้ผู้ใช้อาจแทรกคอลัมน์ — ระบบใช้ `headerMap_` ไม่ผูก index ตายตัวทุกคอลัมน์

---

## 📊 ชีต #2: `ตารางงานประจำวัน` (DAILY) — 32 คอลัมน์

**หน้าที่:** โหลดจาก SCG API แล้วแมชต์กับ MASTER (ปุ่ม 2)

| Col | Index | Header | ใครเขียน |
|-----|-------|--------|----------|
| A | 0 | ID_งานประจำวัน | SCG |
| B | 1 | PlanDelivery | SCG |
| C | 2 | InvoiceNo | SCG |
| D | 3 | ShipmentNo | SCG |
| E | 4 | DriverName | SCG |
| F | 5 | TruckLicense | SCG |
| G | 6 | CarrierCode | SCG |
| H | 7 | CarrierName | SCG |
| I | 8 | SoldToCode | SCG |
| J | 9 | SoldToName | SCG |
| K | 10 | **ShipToName** | SCG |
| L | 11 | **ShipToAddress** | SCG |
| M | 12 | LatLong_SCG | SCG |
| N | 13 | MaterialName | SCG |
| O | 14 | ItemQuantity | SCG |
| P | 15 | QuantityUnit | SCG |
| Q | 16 | ItemWeight | SCG |
| R | 17 | DeliveryNo | SCG |
| S | 18 | จำนวนปลายทาง_System | SCG |
| T | 19 | รายชื่อปลายทาง_System | SCG |
| U | 20 | ScanStatus | SCG (default รอสแกน) |
| V | 21 | DeliveryStatus | SCG (default ยังไม่ได้ส่ง) |
| W | 22 | Email พนักงาน | SCG |
| X | 23 | จำนวนสินค้ารวมของร้านนี้ | SCG aggregate |
| Y | 24 | น้ำหนักสินค้ารวมของร้านนี้ | SCG aggregate |
| Z | 25 | จำนวน_Invoice_ที่ต้องสแกน | SCG aggregate |
| AA | 26 | **LatLong_Actual** | **ปุ่ม 2** |
| AB | 27 | ชื่อเจ้าของสินค้า_Invoice_ที่ต้องสแกน | SCG |
| AC | 28 | ShopKey | SCG |
| AD | 29 | **MATCH_KEY** | SCG โหลด / ปุ่ม 2 ใช้ lookup |
| AE | 30 | **MD_ID** | **ปุ่ม 2** |
| AF | 31 | **LatLong_Actual_Status** | **ปุ่ม 2** (FOUND / REVIEW) |

**Config:** `DATA_IDX`, `DATA_HEADERS` ใน `00_Config.gs`

---

## 📊 ชีต #3: `MASTER_PLACE` — 27 คอลัมน์

**หน้าที่:** ฐานสถานที่มาตรฐาน

### ส่วนปุ่ม 1 (คอลัมน์ A–T = 20 คอลัมน์)

| Col | Index | Header | หมายเหตุ |
|-----|-------|--------|----------|
| A | 0 | **MD_ID** | เช่น MD-0001 |
| B | 1 | **MATCH_KEY** | name\|addr\|owner (clean) |
| C | 2 | NAME_CLEAN | |
| D | 3 | ADDR_CLEAN | |
| E | 4 | OWNER_CLEAN | |
| F | 5 | LAT | พิกัดเฉลี่ย |
| G | 6 | LNG | |
| H | 7 | POINTS | นับครั้งที่พบ (ข้ามวัน) |
| I | 8 | FIRST_SEEN | |
| J | 9 | LAST_SEEN | ใช้กัน POINTS inflation |
| K | 10 | STATUS | ACTIVE |
| L | 11 | RAW_NAMES | |
| M | 12 | RAW_ADDRS | |
| N | 13 | PROVINCE | จากที่อยู่ปลายทาง + SYS_TH_GEO |
| O | 14 | AMPHOE | |
| P | 15 | CONFIRMED_BY | ปุ่ม 1 เขียน |
| Q | 16 | REVIEW_NOTE | ปุ่ม 1 เขียน |
| R | 17 | FIRST_LAT | |
| S | 18 | FIRST_LNG | |
| T | 19 | UPDATED_AT | |

### ส่วนปุ่ม 3 (คอลัมน์ U–AA = 7 คอลัมน์) — **ไม่ทับปุ่ม 1**

| Col | Index | Header | หมายเหตุ |
|-----|-------|--------|----------|
| U | 20 | Rahatpraisanee | รหัสไปรษณีย์ |
| V | 21 | Changwat | จังหวัด |
| W | 22 | Amphoe_Khet | อำเภอ/เขต |
| X | 23 | Tambon_Kwaeng | ตำบล/แขวง |
| Y | 24 | Reversegeocode | ข้อความดิบจากต้นทาง |
| Z | 25 | Calculatedistances | ระยะทาง |
| AA | 26 | GEO_LAYER | ชั้นที่แมชต์ได้ / CHECK_NOTE |

**Config:** `MASTER_IDX`, `MASTER_HEADERS`  
**ปุ่ม 1 ใช้ `MASTER_COLS = 20`** — ไม่เขียน U–AA

---

## 📊 ชีต #4: `การตั้งค่า` (SETTINGS)

**หน้าที่:** Log การรัน (read-oriented)

| Col | Header | ตัวอย่าง |
|-----|--------|---------|
| A | วันที่เวลา | timestamp |
| B | รายการ | ชื่อฟังก์ชัน |
| C | รายละเอียด | processed=… |

---

## 📊 ชีต #5: `SYS_TH_GEO` — 32 คอลัมน์ (A–AF)

**หน้าที่:** พจนานุกรมภูมิศาสตร์ ไทย + อังกฤษ (~7,537 แถว)

### ไทย (A–P)

| Col | Index | Header |
|-----|-------|--------|
| A | 0 | รหัสไปรษณีย์ |
| B | 1 | แขวง/ตำบล |
| C | 2 | เขต/อำเภอ |
| D | 3 | จังหวัด |
| E | 4 | หมายเหตุ |
| F | 5 | ตำบล_clean |
| G | 6 | อำเภอ_clean |
| H | 7 | ตำบล_label |
| I | 8 | อำเภอ_label |
| J | 9 | tambon_norm |
| K | 10 | amphoe_norm |
| L | 11 | province_norm |
| M | 12 | search_key |
| N | 13 | postal_key |
| O | 14 | **note_type** |
| P | 15 | note_scope |

### อังกฤษ (Q–AF)

| Col | Index | Header |
|-----|-------|--------|
| Q | 16 | POSTCODE_EN |
| R | 17 | SUBDISTRICT_EN |
| S | 18 | DISTRICT_EN |
| T | 19 | PROVINCE_EN |
| U | 20 | NOTE_EN |
| V | 21 | SUBDISTRICT_CLEAN_EN |
| W | 22 | DISTRICT_CLEAN_EN |
| X | 23 | SUBDISTRICT_LABEL_EN |
| Y | 24 | DISTRICT_LABEL_EN |
| Z | 25 | TAMBON_NORM_EN |
| AA | 26 | AMPHOE_NORM_EN |
| AB | 27 | PROVINCE_NORM_EN |
| AC | 28 | SEARCH_KEY_EN |
| AD | 29 | POSTAL_KEY_EN |
| AE | 30 | **NOTE_TYPE_EN** |
| AF | 31 | NOTE_SCOPE_EN |

**note_type สำคัญ**

| ค่า | ความหมาย |
|-----|----------|
| `FULL_AREA` | เติม geo อัตโนมัติได้ |
| `CHECK_NOTE` | **ห้ามเติมอัตโนมัติ** (ขอบเขตบางส่วน เช่น เฉพาะอาคาร/ยกเว้นซอย) |

**ชั้นแมชต์ (เร็ว → ช้า)**

1. Exact (postal / search_key) — O(1)  
2. Province / amphoe scan  
3. Fuzzy bigram ≥ 0.80 บน pool ต่อจังหวัด  
4. Levenshtein ≤ 1 บน pool ต่อจังหวัด  

ขั้น 3–4 ช้าบนจังหวัดใหญ่ (เช่น นครราชสีมา ~289 แถวใน pool) — **ข้อจำกัดที่รู้จัก ไม่ใช่บั๊ก**

**Config:** `GEO_DICT_IDX`

---

## 📊 ชีต #6: `สรุป_เจ้าของสินค้า` — 6 คอลัมน์

| Col | Index | Header |
|-----|-------|--------|
| A | 0 | SummaryKey |
| B | 1 | SoldToName |
| C | 2 | PlanDelivery |
| D | 3 | จำนวน_ทั้งหมด |
| E | 4 | จำนวน_E-POD_ทั้งหมด |
| F | 5 | LastUpdated |

**Config:** `SUMMARY_OWNER_IDX`

---

## 📊 ชีต #7: `สรุป_Shipment` — 7 คอลัมน์

| Col | Index | Header |
|-----|-------|--------|
| A | 0 | ShipmentKey |
| B | 1 | ShipmentNo |
| C | 2 | Truck |
| D | 3 | PlanDelivery |
| E | 4 | จำนวน_ทั้งหมด |
| F | 5 | จำนวน_E-POD_ทั้งหมด |
| G | 6 | LastUpdated |

**Config:** `SUMMARY_SHIP_IDX`

---

## 📊 ชีต #8: `Input`

| เซลล์ / คอลัมน์ | ความหมาย |
|----------------|----------|
| B1 | Cookie สำหรับ API |
| B3 | Shipment string (ถ้าใช้) |
| A4+ | รายการ Shipment No |

**Config:** `SCG_CONFIG`, `INPUT_IDX`

---

## 📊 ชีต #9: `ข้อมูลพนักงาน` — 8 คอลัมน์

| Col | Index | Header |
|-----|-------|--------|
| A | 0 | ID |
| B | 1 | ชื่อ (map key) |
| C | 2 | โทร |
| D | 3 | บัตรประชาชน |
| E | 4 | ทะเบียนรถ |
| F | 5 | ประเภทรถ |
| G | 6 | **Email** (mapped value) |
| H | 7 | บทบาท |

**Config:** `EMPLOYEE_IDX`

---

## 📊 ชีต #10: `SYS_MASTER_IDX` (Master Index)

**หน้าที่:** ดัชนีเบาสำหรับปุ่ม 2 — ไม่ต้องโหลด MASTER_PLACE ทั้งแผ่นทุกครั้ง

| Col | Index | Header | ความหมาย |
|-----|-------|--------|----------|
| A | 0 | **MD_ID** | รหัสสถานที่ (กุญแจ upsert) |
| B | 1 | **MATCH_KEY** | key ตรง (`makeKey`) |
| C | 2 | **ALIAS_KEY** | key แบบลบช่องว่าง / `-` |
| D | 3 | **LAT** | ละติจูดล่าสุด |
| E | 4 | **LNG** | ลองจิจูดล่าสุด |

**กติกาเขียน (ปุ่ม 1)**

- มี MD_ID อยู่แล้ว → อัปเดตแถวนั้น  
- ยังไม่มี → append ท้ายชีต  
- **ไม่ลบทั้งชีต** — ของเก่าไม่หาย  

**การอ่าน (ปุ่ม 2)**

- โหลดชีตนี้ก่อนสร้าง map3 / map3a  
- ถ้าว่าง → fallback ไป `MASTER_PLACE`  

**เมนูซ่อมครั้งแรก**

`ดูผล / รีเซ็ต → ซ่อมดัชนี SYS_MASTER_IDX จาก MASTER (ไม่ลบของเก่า)`

**Config:** `MASTER_IDX_SHEET_HEADERS`, `MASTER_IDX_SHEET`, `SHEETS.MASTER_IDX`

---

## 🔗 ใครเขียนอะไร (กันทับกัน)

| ชีต / คอลัมน์ | ปุ่ม 1 | ปุ่ม 2 | ปุ่ม 3 | SCG โหลด |
|---------------|--------|--------|--------|----------|
| SOURCE helper (MD_LINK…STATUS) | ✅ เขียน | — | — | — |
| MASTER A–T (20 cols) | ✅ เขียน | อ่านอย่างเดียว | — | — |
| MASTER U–AA (7 cols) | — | — | ✅ เขียน | — |
| DAILY LatLong_Actual / MD_ID / Status | — | ✅ เขียน | — | เว้นไว้ |
| DAILY MATCH_KEY | — | ใช้ / เติมถ้าว่าง | — | ✅ สร้างตอนโหลด |
| SYS_MASTER_IDX | ✅ upsert | ✅ อ่าน | — | — |
| SYS_TH_GEO | อ่าน | — | อ่าน | — |

---

## 📌 หลักการสำคัญ

1. **ไม่แก้หัวคอลัมน์อัตโนมัติ** — Setup / Config เป็น audit อย่างเดียว  
2. **MATCH_KEY ชุดเดียว** — `makeKey` / `makeKeyAlias` ใน `00_CleanService.gs`  
3. **ปุ่ม 3 ไม่ทับปุ่ม 1** — คนละช่วงคอลัมน์บน MASTER  
4. **ปุ่ม 2 ไม่เขียน MASTER** — อ่านดัชนีหรือ MASTER แล้วเขียนเฉพาะ DAILY  
5. **Index ใน Config เป็น default** — ชีต SOURCE/DAILY/MASTER ใช้ dynamic header เป็นหลัก  

---

*เอกสารอ้างอิงคอลัมน์ — ซิงค์ label กับแพ็กเกจ v5.5.6; รายละเอียด index จริงดู `00_Config.gs`*

### หมายเหตุปุ่ม 3/3b (ตรงโค้ด v5.5.6)
- เขียนเฉพาะช่วง 7 คอลัมน์ราชการบน MASTER (U–AA ตาม Config/หัวตารางจริง)
- PATCH-6: `Reversegeocode` ที่เป็น EN สะอาดจะไม่ถูกทับจาก SOURCE ล่าสุด
- ล้างเฉพาะช่วงนี้ใช้เมนู 🧹 ล้างเฉพาะ 7 คอลัมน์ราชการ (U-AA)

