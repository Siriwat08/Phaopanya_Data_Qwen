# Wayfinder Map — Geo Self-Learn (ปุ่ม 3 / 3b)

**Label:** `wayfinder:map`  
**Created:** 2026-09-05 · **อัปเดต v2:** 2026-09-06 — sync v5.5.7 + สถานะงานจริง + ใช้กับ Super Z ในแชทได้ทันที  
**Tracker:** local-markdown — แนะนำวางที่ `Other/wayfinder/geo-learn/` ใน repo Phaopanya_Data_Zai (ผลักขึ้น GitHub ได้) หรือ `artifacts/wayfinder/geo-learn/` ในเครื่องตามเดิม  
**Parent domain:** Phaopanya Master Data **v5.5.7** (AUDIT FIX-1..4 + ถอด SPREADSHEET_ID)  
**Status:** 1 / 10 closed — G01 ✓ · G02 / G03 เริ่มได้ทันที

> แผนคู่หูเดิม (Runtime Proof T01–T10) รวมเข้า STABILITY_PLAN / คิว deploy ขั้น 1–6 แล้ว — แผนนี้จึงยืนอยู่อย่างอิสระ ไม่ต้องรอใบรับจากแผนนั้น

---

## Destination

ออกแบบและล็อกวิธีให้ระบบ **เรียนรู้จากการกรอกมือ** (แถวที่ `GEO_LAYER = MANUAL`) แล้วเก็บลงตารางแยก **`SYS_GEO_LEARN`** สถานะ `PENDING` / `APPROVED` — โดยปุ่ม 3/3b จะใช้เฉพาะกฎที่ **APPROVED** เท่านั้น เพื่อช่วยจับคู่แถวที่คล้ายกันในรอบถัดไป

ยังคงนโยบาย **ไม่เดาตำบล/รหัส**  
ยัง **ไม่รวมปุ่ม 3 กับ 3b** ในแผนนี้  
ยัง **ไม่บังคับ** ให้ทุก no-match เติมเองโดยไม่มีคนยืนยัน

**Definition of done (เมื่อแผนนี้ปิด):**
- สเปกคอลัมน์ `SYS_GEO_LEARN` ล็อกแล้ว
- ล็อกแล้วว่า "คีย์เรียน" และ "ค่าที่เรียน" คืออะไร
- ล็อกแล้วว่าใคร/อย่างไรเปลี่ยน PENDING → APPROVED
- ล็อกแล้วว่าชั้นเรียนรู้แทรกใน pipeline ปุ่ม 3/3b ตำแหน่งไหน โดยไม่ทับ MANUAL เดิม
- ล็อกแล้วกรณีชนกับ SYS_TH_GEO และการไม่เรียนรู้ขยะ
- มีรายการ decision ครบ จนทีมลงมือ implement ได้โดยไม่ต้องเดาเจตนา

---

## Notes

- **โค้ดฐาน:** v5.5.7 — ปุ่ม 3 (TH), 3b (EN), PATCH-6 Upgrade-only Y, skip แถวที่ GEO_LAYER (คอลัมน์ AA) มีค่า (รวม MANUAL), FIX-2: ชั้น TAMBON_LEV/AMPHOE_LEV ฝั่งไทยมี `postalOk_` แล้วเท่าฝั่ง EN
- **สถานะงานจริง (06/09/2026):** กรอกมือครบ **73 แถว** (15 แถว layer ว่าง + 58 แถว CHECK_NOTE) · วาง 06_GoogleMapsService ใหม่ (ถอด SPREADSHEET_ID) แล้ว · repo push โค้ด v5.5.7 แล้ว · **ค้าง:** วาง 4 แถว FULL_AREA วังทองหลาง 10310 (แทรกเหนือแถว 153 + ล้าง Cache SYS_TH_GEO) แล้วรัน 3b ตรวจรับ
- **หลักฐานล่าสุด:** แถว Y=EN สะอาด + GEO_LAYER ว่าง = no-match ตามนโยบาย; กรอกมือต้องใส่ MANUAL กันทับ; พบ Y ขยะจริง เช่น "65000" (MD-9576)
- **Decision ที่ล็อกแล้ว:** เก็บเรียนรู้ที่ตารางแยก `SYS_GEO_LEARN` ไม่เขียนทับ dict ตรง ๆ (ตัวเลือก A) → [D01 เก็บความรู้เป็นตารางแยก](decisions/D01-separate-learn-table.md)
- **วิธีทำ ticket:** คุยกับ **Super Z ในแชท** — grilling = Super Z ตั้งคำถามชี้ขาด ผู้ใช้ตอบเจตนาจริง · การตรวจโค้ด/ข้อมูลจริง Super Z อ่าน repo และ XLSX ได้ทันที (ไม่ต้องพึ่ง skill ภายนอกที่ไม่มีอยู่จริง)
- **กติกาปิด ticket (tracker ท้องถิ่น):** แนบ `## Resolution (วันที่)` ท้ายไฟล์ ticket → เปลี่ยน `Status: closed` → ย้ายบรรทัดเข้า "Decisions so far" ข้างล่าง พร้อมลิงก์ไฟล์
- **กฎแผน:** หนึ่ง ticket ต่อรอบสนทนา; แผนนี้เน้น **decision / spec** — ไม่ implement จนกว่า map จะเคลียร์
- อ้างอิง ticket ด้วย **ชื่อเรื่อง** ไม่ใช่เลขเปล่าในบทสนทนา

---

## Decisions so far

- [D01 เก็บความรู้เป็นตารางแยก SYS_GEO_LEARN + PENDING/APPROVED](decisions/D01-separate-learn-table.md): ไม่เขียนกลับ SYS_TH_GEO โดยตรง; ปุ่ม 3/3b ใช้เฉพาะกฎ APPROVED
- [G01 Lock SYS_GEO_LEARN column schema](tickets/G01-lock-sys-geo-learn-schema.md): ล็อก 22 คอลัมน์ (5 บล็อก + สถิติสำรอง) — กฎ 1 แถวคู่ TH/EN แบบ SYS_TH_GEO · ค่า EN เติมอัตโนมัติจาก dict · MD_ID เดี่ยว + EVIDENCE/CONFIDENCE · STATUS 3 ค่า · ไม่เก็บพิกัด · HIT_COUNT สำรอง

---

## Not yet specified

- UI อนุมัติกฎ (ชีตกรอง / เมนู / AppSheet) — คมหลังสเปกคอลัมน์และ workflow อนุมัติชัด
- ปริมาณกฎสูงสุด / งานบ้านลบกฎเก่า — หลังรู้รูปแบบคีย์
- การเรียนรู้จากปุ่ม 3 (TH) กับ 3b (EN): G01 ล็อกแล้วว่าตารางเดียว + คีย์คู่ในแถวเดียว — เหลือรูปแบบคีย์จริง อยู่ใน G02
- รายงาน KPI "no-match ลดลงหลัง learn" — หลังมี baseline runtime

---

## Out of scope

- รวมปุ่ม 3 + 3b เป็นปุ่มเดียว
- เพิ่มชั้น fuzzy ใหญ่โดยไม่ผ่านวงจร MANUAL → LEARN
- แก้ matching ปุ่ม 1/2 (MASTER key) ในแผนนี้
- CRM / incident / WhatsApp
- บังคับ auto-fill ทุกแถวที่ Google ให้แค่รหัสไปรษณีย์โดยไม่มีคนยืนยัน

---

## Frontier (open, unblocked, unclaimed)

ลำดับแนะนำ:

1. [Lock learn input key from Y or address](tickets/G02-lock-learn-input-key.md) — `grilling`
2. [Lock what fields are learned as output](tickets/G03-lock-learned-output-fields.md) — `grilling`

ถูกบล็อก (รอใบข้างบน):

- [Lock when a MANUAL row creates a PENDING rule](tickets/G04-lock-when-pending-rule-is-created.md) — รอ G02, G03 (G01 ปิดแล้ว)
- [Lock approval workflow PENDING to APPROVED](tickets/G05-lock-approval-workflow.md) — รอ G01, G04
- [Lock where LEARN layer sits in button 3b pipeline](tickets/G06-lock-learn-layer-in-3b-pipeline.md) — รอ G02, G03, G05
- [Lock conflict policy vs SYS_TH_GEO](tickets/G07-lock-conflict-vs-dict.md) — รอ G03, G06
- [Lock anti-garbage rules so bad manuals are not learned](tickets/G08-lock-anti-garbage-rules.md) — รอ G04
- [Lock MANUAL row protection forever](tickets/G09-lock-manual-row-protection.md) — รอ G06
- [Write implementable handoff spec](tickets/G10-write-implementable-handoff-spec.md) — รอ G01–G09

---

## How to continue

พิมพ์ในแชทกับ Super Z เช่น: **claim G02 Lock learn input key** (หรือ G03)  
รอบนั้นเคลียร์ได้เพียงหนึ่ง ticket — Super Z จะถาม–ตอบจนได้มติ บันทึก Resolution ลงไฟล์ ticket อัปเดต MAP แล้วปิดรอบ  
คืบหน้า: G01 ✓ ปิดแล้ว · เหลืออีก 9 ใบ (G02–G10) — G10 คือสเปกส่งต่อการ implement
