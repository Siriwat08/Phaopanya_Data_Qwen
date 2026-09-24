/**
 * CleanService — ล้างข้อมูลไทยเป็นมาตรฐาน (v6 — รวมแพตช์ TASK44-1 เข้าตัวหลัก)
 * หลักฐานจากข้อมูลจริง 13,935 แถว + 200 แถวทดสอบ:
 *   1. EXACT 3-คอลัมน์ (cleanName|cleanAddr|cleanOwner) — แมชต์หลัก ~100% เมื่อคนขับ/ระบบพิมพ์คำเดียวกัน
 *   2. ALIAS 3-คอลัมน์ (ลบช่องว่าง + ลบ '-') — จับกรณี 'บ.เอชทูโอ-ไฮโดร' vs 'บริษัท เอชทูโอไฮโดร', 'ถ ราชพฤกษ์' vs 'ถราชพฤกษ์'
 *   3. REVIEW — งานที่ข้อมูลเขียนไม่เหมือนจริง (คนละที่/พิมพ์คนละแบบมาก) ให้คนดู
 *
 * หมายเหตุ: ไม่มี FALLBACK 2-คอลัมน์ในโค้ดจริง — ใช้เฉพาะ exact3 + alias3
 * ปุ่ม 1 / ปุ่ม 2 / Service_SCG ใช้ makeKey + makeKeyAlias ชุดเดียวกันเท่านั้น
 *
 * [REFACTOR 2026-09-24] แพตช์ TASK44-1 (GAS_patches/00_CleanService_prefix_phone_patch.gs)
 * ถูกรวมเข้าไฟล์นี้เป็นทางการ — กฎ DUP_PREFIX (เขตเขต/แขวงแขวง) และ PHONE/LOOSE
 * (เบอร์โทร + เลขยาวปะปนชื่อ) เป็นส่วนหนึ่งของ production แล้ว
 * ⚠️ dual placement: โค้ดฝั่ง Cleanup Suite (51_CleanupLib.clCheckCleanThaiPatch_)
 *   ตรวจว่า cleanThai ผ่าน 3 เคสถาวรถือว่า "วางแพตช์แล้ว" — ไฟล์นี้ผ่านครบจึงปลดล็อกเฟส 1b
 */

/** แปลงเลขไทยเป็นเลขอาหรับ */
function cleanThaiDigits_(s) {
  const map = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
                '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };
  return s.replace(/[๐-๙]/g, function (c) { return map[c]; });
}

/**
 * ล้างเท็กซ์ไทยเป็นมาตรฐาน: ตัดวงเล็บ+โทร., คำนำหน้าชื่อ, เลขไทย, สัญลักษณ์
 * + กฎใหม่ (แพตช์ TASK44-1 รวมเข้าตัวหลัก):
 *   [PHONE]  ตัดเบอร์โทร 0x-xxx-xxxx / เลขติดกัน 7 หลักขึ้นไป / คั่น . - / ≥7 กลุ่ม
 *            — กัน PII หลุดมาใน NAME_CLEAN (~834 แถวที่ตรวจพบ 2026-09-22)
 *   [DUP_PREFIX] รวมคำนำหน้าเขตการปกครองซ้ำ "เขตเขต/แขวงแขวง" → "เขต/แขวง"
 *            — แก้ ADDR_CLEAN เสีย ~6,449 แถว (idempotent: รันซ้ำผลเท่าเดิม)
 * ลำดับสำคัญ: แปลงเลขไทยก่อน → จึงตัดเบอร์ (จับเบอร์เลขไทยได้) → รวมคำนำหน้าซ้ำ
 */
function cleanThai(s) {
  if (s === undefined || s === null) return '';
  let str = String(s).trim();
  if (!str) return '';
  // ตัดครึ่งวงเล็บ/วงเล็บพร้อมเนื้อหา (ชั้นเดียว — วงเล็บซ้อนลึกอาจเหลือเศษ)
  str = str.replace(/[\[\(][^\]\)]*[\]\)]/g, ' ');
  // ตัด "โทร." พร้อมเลขที่ตามหลัง
  str = str.replace(/โทร\.?\s*\d[\d\- ๐-๙]{3,}/g, ' ');
  // ตัดคำนำหน้าชื่อคน: นาย/นาง/นางสาว/คุณ/ดร.
  str = str.replace(/^(นาย|นาง|นางสาว|คุณ|ดร\.?)\s+/g, ' ');
  // แปลงเลขไทย→อาหรับ (ต้องมาก่อนกฎเบอร์ ถึงจะจับเบอร์เลขไทยได้)
  str = cleanThaiDigits_(str);

  // ★ [TASK44-1a] ตัดเบอร์โทร 2 แบบ — หลังแปลงเลข ก่อนตัดสัญลักษณ์
  //   1) รูปแบบมาตรฐาน 0x-xxx-xxxx / 0x xxx xxxx / 0xxxxxxx (9-10 หลัก)
  //      guard (^|[^\d]) + (?!\d) ไม่ตัดกลางเลขยาวกว่า
  var __s0 = str;
  str = str.replace(/(^|[^\d])(0\d{1,2}[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4})(?!\d)/g, '$1 ');
  //   2) แบบหลวม: ตัวเลขติดกัน 7 หลักขึ้นไป หรือคั่นด้วย - วรรค . / อย่างน้อย 7 กลุ่ม
  //      (จับรหัส DN/พนักงานที่ปะมากับชื่อ — ไม่กระทบบ้านเลขที่ปกติ)
  str = str.replace(/(^|[^\d])(\d{7,}|\d(?:[\s\-\.\/]\d){6,})(?!\d)/g, '$1 ');
  //   3) ลบเศษคั่นท้าย (เช่น 'คุณpang /') เฉพาะเมื่อมีเบอร์ถูกตัดจริง — เทียบเท่าชุด Python
  if (str !== __s0) str = str.replace(/[\s\/\-]+$/, '');

  // ★ [TASK44-1b] รวมคำนำหน้าเขตการปกครองที่ซ้ำ:
  //   เขตเขต/เขต เขต → เขต | แขวงแขวง → แขวง | ตำบล ตำบล → ตำบล | ฯลฯ
  str = str.replace(/(เขต|แขวง|ตำบล|อำเภอ|จังหวัด)\s*\1+/g, '$1');

  // ตัดสัญลักษณ์ เหลือเฉพาะไทย+อาหรับ+อังกฤษ+ช่องว่าง+ยัติภังค์+สแลช
  str = str.replace(/[^A-Za-z0-9ก-๙ \-\/]/g, ' ');
  // รวมช่องว่างซ้ำ
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * ล้างชื่อคน/บริษัท โดยเก็บคำของชื่อเดิมไว้ครบ ไม่ตัดคำหน้า/ท้ายชื่อ
 * ห้ามลบคำว่า บริษัท, บจก., จำกัด — จะทำให้ NAME_CLEAN และ MATCH_KEY ผิด
 * (alias ช่วยแค่ลบช่องว่าง/-)
 */
function cleanName(s) {
  return cleanThai(s);
}

/**
 * ล้างที่อยู่: ตัดคำนำหน้าตำบล/อำเภอ/จังหวัด ที่ต้นสตริง และเลขไปรษณีย์ท้าย
 * ตัดเฉพาะต้นสตริง (^) — ไม่ขยาย global เพื่อไม่เปลี่ยน MATCH_KEY ของ MASTER เดิม
 */
function cleanAddr(s) {
  let str = cleanThai(s);
  str = str.replace(/^(แขวง|เขต|ตำบล|อําเภอ|อำเภอ|จังหวัด|จ\.|ตําบล|หมู่|ม\u0E48)\s*/g, '');
  str = str.replace(/\s*\d{5}\s*$/, '');
  return str.replace(/\s+/g, ' ').trim();
}

/** ล้างชื่อเจ้าของสินค้า — ใช้ cleanName ชุดเดียวกัน */
function cleanOwner(s) {
  return cleanName(s);
}

/** ลบช่องว่างทั้งหมดและยัติภังค์ (สำหรับ alias key) */
function aliasOf(s) {
  return s.replace(/\s+/g, '').replace(/-/g, '');
}

/** EXACT key: cleanName | cleanAddr | cleanOwner */
function makeKey(name, addr, owner) {
  return [cleanName(name), cleanAddr(addr), cleanOwner(owner)].join('|');
}

/** ALIAS key: alias(cleanName) | alias(cleanAddr) | alias(cleanOwner) */
function makeKeyAlias(name, addr, owner) {
  return [aliasOf(cleanName(name)), aliasOf(cleanAddr(addr)), aliasOf(cleanOwner(owner))].join('|');
}
