# Lock what fields are learned as output

**ID:** G03  
**Type:** `wayfinder:grilling` (HITL)  
**Status:** open  
**Blocks:** G04, G06, G07, G10  
**Blocked by:** none  
**Claimed by:** —

---

## Question

เมื่อกฎ APPROVED ถูกใช้ ระบบจะเขียนค่าอะไรลง MASTER บ้าง — เฉพาะ U/V/W/X หรือรวม GEO_LAYER ป้ายอะไร และ Z แตะไหม?

---

## Context

- ตอนนี้ MANUAL กันการทับผ่านกติกา "skip แถวที่ GEO_LAYER (คอลัมน์ AA) มีค่า" — ทั้งปุ่ม 3 และ 3b (ตรวจจากโค้ด v5.5.7 แล้ว)
- แถวที่ learn ช่วยได้ควรได้ป้าย layer ชัด (เช่น `LEARN_APPROVED`) ไม่ปล่อยว่าง
- Y (Reversegeocode) ตาม PATCH-6 เป็น upgrade-only — การ learn ไม่ควรดาวน์เกรด Y
- Z (Calculatedistances) เป็นระยะทางจาก reverse geocode — โดยทั่วไปไม่ควรให้ LEARN ไปทับ
- ป้าย layer ใหม่ต้องให้ 99_SelfTest และสถิติผลปุ่ม (03_Menu) รับรู้ด้วย ไม่ใช่ค่าลอยที่รายงานไม่รู้จัก

ต้องล็อก:

- เขียน U V W X หรือไม่
- ค่า GEO_LAYER เมื่อ hit จาก LEARN (ตั้งชื่อป้ายจริง เช่น LEARN / LEARN_APPROVED / LEARN_EN)
- ห้ามแตะ Y/Z หรือมีข้อยกเว้น

---

## Done when

รายการฟิลด์ที่ LEARN เขียนได้ / ห้ามเขียน ชัดเจน และชื่อป้าย GEO_LAYER เมื่อมาจากกฎที่อนุมัติแล้ว (ใช้ต่อใน G06/G07/G10)
