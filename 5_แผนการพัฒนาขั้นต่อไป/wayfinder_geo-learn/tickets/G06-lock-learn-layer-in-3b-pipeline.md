# Lock where LEARN layer sits in button 3b pipeline

**ID:** G06  
**Type:** `wayfinder:grilling` (HITL)  
**Status:** open  
**Blocks:** G07, G09, G10  
**Blocked by:** G02, G03, G05  
**Claimed by:** —

---

## Question

ใน pipeline ปุ่ม 3b (และถ้ามี ปุ่ม 3) ชั้นค้น `SYS_GEO_LEARN` (APPROVED เท่านั้น) อยู่ **ก่อน / หลัง / แทน** ชั้น dict 9 ชั้น ณ จุดไหน?

---

## Context

ลำดับมีผลต่อความถูกต้อง:

- ก่อน dict → เร็ว แต่อาจชนนโยบายราชการถ้ากฎเก่าผิด
- หลัง no-match dict เท่านั้น → ปลอดภัยกว่า ใช้ learn แค่ตอน dict ไม่เจอ
- แทรกกลางชั้น EN → ซับซ้อน ดูแลยาก

ของเดิม (ตรวจจากโค้ด v5.5.7): ปุ่ม 3/3b ไล่ dict 9 ชั้นต่อภาษา (EXACT3 → POSTAL → PROV → FUZZY → LEV โดย LEV มี `postalOk_` แล้วทั้งสองภาษาตาม FIX-2) · ถ้า GEO_LAYER มีค่า = skip ทั้งแถว · no-match ปล่อยราชการว่าง

ตัวอย่างจริงที่ควรรู้ก่อนตัดสิน: วังทองหลาง 28 แถวเคย no-match เพราะ Google คืน 10312/10240 และสะกด Phlabphla — แต่หลังวาง 4 แถว FULL_AREA ใน dict กลุ่มนี้เติมอัตโนมัติผ่านชั้น fallback ของ dict เอง → LEARN จะเหลือหน้าที่จริงเฉพาะเคสที่ dict ยังไม่มีแถวรองรับ ไม่ใช่แกน้อยรหัสไปรษณีย์

---

## Done when

มติตำแหน่งชั้น LEARN ในลำดับ + ใช้กับ 3b อย่างเดียวหรือทั้ง 3 และ 3b + พฤติกรรมเมื่อ hit (เขียนอะไร ป้ายอะไร หยุดไล่ต่อไหม)
