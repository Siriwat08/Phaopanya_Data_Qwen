# Lock SYS_GEO_LEARN column schema

**ID:** G01  
**Type:** `wayfinder:grilling` (HITL)  
**Status:** closed (2026-09-06)  
**Blocks:** G04, G05, G10  
**Blocked by:** none  
**Claimed by:** Siriwat (ผ่าน Super Z — 06/09/2026) — ปิดแล้วรอบเดียวจบ

---

## Question

ตาราง `SYS_GEO_LEARN` ต้องมีคอลัมน์อะไรบ้าง (ชื่อ + ความหมาย + บังคับ/ไม่บังคับ) เพื่อรองรับ PENDING/APPROVED และการไล่ย้อนกลับว่ากฎมาจากแถว MANUAL ใด?

---

## Context

- Decision ที่ล็อกแล้ว: ตารางแยก ไม่เขียนทับ SYS_TH_GEO ตรง ๆ — ดูรายละเอียดเหตุผลที่ [D01](../decisions/D01-separate-learn-table.md)
- ต้องรู้ที่มา (MD_ID ต้นทาง, ข้อความ Y, ผู้กรอก, วัน)
- ต้องมีสถานะและผู้อนุมัติ
- ควรออกแบบให้ query ตอนปุ่ม 3b เร็ว (คีย์ค้นหาชัด) — โครงควรคล้าย SYS_TH_GEO ที่มี SEARCH_KEY/POSTAL_KEY ให้โหลดครั้งเดียวแล้วเก็บ cache (ดู SHEETS_REFERENCE.md)
- **ข้อมูล seed มีอยู่จริง:** MANUAL 73 แถว (15 แถว layer ว่าง + 58 แถว CHECK_NOTE) คือแหล่งกฎชุดแรก — schema ต้องรับได้ทั้งฝั่ง TH และ EN
- ชื่อชีตใหม่ต้องไม่ชนชื่อที่มี (MASTER / SYS_TH_GEO / SYS_MASTER_IDX / Reversegeocode / ตารางงานประจำวัน)

ตัวอย่างฟิลด์ที่ต้องตัดสินว่าเอา/ไม่เอา:

- LEARN_ID, STATUS (PENDING|APPROVED|REJECTED)
- SOURCE_MD_ID, SOURCE_Y_TEXT, SOURCE_Y_NORM
- POSTAL, PROVINCE, DISTRICT, SUBDISTRICT (ค่าที่คนยืนยัน)
- LANG (TH|EN), HIT_COUNT, CREATED_AT, APPROVED_AT, APPROVED_BY, NOTE

---

## Done when

มีตารางสเปกคอลัมน์ที่ยอมรับแล้ว 1 ชุด (ชื่อคอลัมน์ + ชนิด + ความหมายสั้น ๆ) พร้อมสถานะเริ่มต้นของแถวใหม่ + ตัวอย่าง 1 แถวจริงจาก MANUAL 73 แถวที่ schema รับได้ครบ

---

## Resolution (2026-09-06 — ผ่าน Super Z grilling 6 ข้อ)

### มติ 6 ข้อ

1. **โครงภาษา = คู่ในแถวเดียว** (แบบ SYS_TH_GEO): กฎ 1 แถวมีคีย์ + ค่าฝั่งไทยและ EN ครบ — ใช้ได้ทั้งปุ่ม 3 และ 3b โดยไม่ต้องสร้างกฎ 2 แถว
2. **ที่มา = MD_ID เดี่ยว**: SOURCE_MD_ID + แถว Excel + ข้อความ Y ชุดเดียว ไล่ย้อนได้ทันที
3. **เก็บ EVIDENCE + CONFIDENCE ทั้งสอง** — ข้อมูลมีอยู่แล้วในรายงาน 73 แถว อนุมัติเร็วขึ้น
4. **สถิติ HIT_COUNT / LAST_HIT_AT = เก็บแบบเลื่อน**: มีคอลัมน์ใน schema ตั้งแต่วันนี้ แต่ยังไม่เขียนโค้ดนับ (เปิดทีหลังได้ ไม่ต้องแก้ schema)
5. **STATUS = 3 ค่า**: PENDING / APPROVED / REJECTED (ไม่มี DRAFT/SUPERSEDED)
6. **ไม่เก็บพิกัด LAT/LNG**: ไล่จาก SOURCE_MD_ID บน MASTER ได้

### Schema ที่ล็อก (22 คอลัมน์ — 1 แถว = 1 กฎ)

| บล็อก | คอลัมน์ | ความหมาย | ใครเติม | บังคับ |
|---|---|---|---|---|
| ตัวตน (3) | `LEARN_ID` | รหัสกฎ เช่น L-0001 | อัตโนมัติ | ใช่ |
| | `STATUS` | PENDING / APPROVED / REJECTED | เริ่ม PENDING | ใช่ |
| | `LANG_SOURCE` | TH / EN — ภาษาของแถวต้นทาง | อัตโนมัติ | ใช่ |
| คีย์ค้นหา (2) | `LEARN_KEY` | คีย์ฝั่งไทย (รูปแบบล็อกใน G02) | อัตโนมัติ | รอ G02 |
| | `LEARN_KEY_EN` | คีย์ฝั่งอังกฤษ (รูปแบบล็อกใน G02) | อัตโนมัติ | รอ G02 |
| ค่ายืนยัน TH (4) | `POSTAL` `PROVINCE` `DISTRICT` `SUBDISTRICT` | ค่าราชการไทยที่คนยืนยัน (= U/V/W/X) | จากแถว MANUAL | ใช่ |
| ค่ายืนยัน EN (3) | `PROVINCE_EN` `DISTRICT_EN` `SUBDISTRICT_EN` | คู่อังกฤษ — **เติมอัตโนมัติจาก SYS_TH_GEO** (ค้นจาก POSTAL+SUBDISTRICT) ไม่ต้องพิมพ์มือ | อัตโนมัติ | ถ้ามีใน dict |
| ที่มา (3) | `SOURCE_MD_ID` `SOURCE_EXCEL_ROW` `SOURCE_Y_TEXT` | ไล่ย้อนแถวต้นทาง | อัตโนมัติ | ใช่ |
| หลักฐาน (2) | `EVIDENCE` `CONFIDENCE` | หลักฐานสนับสนุน / ระดับมั่นใจ (สูง-กลาง-ต่ำ) | จากรายงานกรอกมือ | EVIDENCE ใช่ |
| อนุมัติ (3) | `APPROVED_AT` `APPROVED_BY` `DECISION_NOTE` | หลักฐานการอนุมัติ/ปฏิเสธ (ขั้นตอนล็อกใน G05) | ผู้อนุมัติ | เมื่อ APPROVED/REJECTED |
| สถิติสำรอง (2) | `HIT_COUNT` `LAST_HIT_AT` | **สำรอง — ยังไม่นับ** คงค่าเริ่ม 0 / ว่าง | (เลื่อน) | ไม่บังคับ |

### ตัวอย่างแถวจริง (MD-0096 จากชุด 58 แถว — ค่า EN ตรง dict แถว 153)

`L-0001 · PENDING · LANG_SOURCE=EN · LEARN_KEY=(รอ G02) · LEARN_KEY_EN=(รอ G02 เช่นหลัก 10310|phlabphla|wang thonglang) · 10310 / กรุงเทพมหานคร / วังทองหลาง / พลับพลา · Bangkok / Wang Thonglang / Phlapphla · SOURCE=MD-0096 แถว 97 "359/2 Suan Luang Rd Khwaeng Phlabphla, Khet Wang Thonglang…" · EVIDENCE="สูง — รามคำแหง 65 อยู่พลับพลา (dict ระบุซอย 65) + โหวต 0.17 กม." · CONFIDENCE=สูง · อนุมัติ/สถิติ = ว่าง`

### หมายเหตุส่งต่อ

- คู่ TH/EN ในแถวเดียวช่วยกัน "กฎเดียวใช้สองปุ่ม" และกันปัญหาสะกด Phlabphla ≠ Phlapphla ในอนาคต เพราะฝั่ง EN ยึดค่าจาก dict เสมอ ไม่ยึดสะกดจาก Google
- แถวต้นทาง EN เท่านั้น (Y จาก Google เป็น EN เสมอ): LEARN_KEY ฝั่งไทยอาจว่างช่วงแรก — เติมทีหลังจากค่ายืนยันได้ ตามรูปแบบที่ G02 ล็อก
- ชื่อชีต `SYS_GEO_LEARN` ไม่ชนชื่อที่มีอยู่ (ตรวจแล้ว: MASTER / SYS_TH_GEO / SYS_MASTER_IDX / Reversegeocode / ตารางงานประจำวัน)
- การเติม EN อัตโนมัติจาก dict ทำให้ไม่ต้อง "กรอกสองชุด" ตามข้อเสียที่เคยกังวล
