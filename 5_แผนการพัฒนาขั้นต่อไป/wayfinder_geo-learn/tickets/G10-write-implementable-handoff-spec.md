# Write implementable handoff spec

**ID:** G10  
**Type:** `wayfinder:task` (HITL)  
**Status:** open  
**Blocks:** none (terminal for this map)  
**Blocked by:** G01, G02, G03, G04, G05, G06, G07, G08, G09  
**Claimed by:** —

---

## Question

หลังตัดสินใจ G01–G09 แล้ว สเปกส่งต่อ implement หนึ่งเอกสาร (สั้นพอ implement ได้โดยไม่เดา) ต้องมีหัวข้ออะไรครบ และเนื้อหาจาก decision ใบก่อนถูกยึดครบหรือยัง?

---

## Context

- แผนนี้จบที่ **spec ที่ทำต่อได้** ไม่บังคับลงโค้ดใน ticket นี้
- handoff ต้องชี้ครบ: schema (G01), คีย์เรียน (G02), output + ป้าย GEO_LAYER (G03), trigger + backfill (G04), approval (G05), ตำแหน่งชั้น LEARN (G06), conflict vs dict (G07), anti-garbage (G08), MANUAL guard (G09)
- เขียนเป็นไฟล์ `SPEC_HANDOFF.md` ในโฟลเดอร์แผนนี้ (หรือ Other/ ใน repo ถ้าอยากให้ตามไป GitHub) + แนบตัวอย่างแถวจริง 2–3 แถวจาก MANUAL 73 แถวประกอบ ให้คน implement เห็นของจริงไม่ต้องเดา

---

## Done when

มีเอกสาร handoff ที่ทีมยืนยันว่า implement ได้โดยไม่ต้องถามเจตนาซ้ำ และ map นี้ปิดได้ (ทุก ticket closed + Decisions so far ครบ 9 รายการ)
