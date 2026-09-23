/**
 * ============================================================================
 * PATCH TASK45-3 — 00_Config.gs : ปั๊ม SCRIPT_VERSION กลาง (กัน version drift)
 * (ต่อยอด TASK44-3 — ใช้อันนี้แทนรุ่นเดิม)
 * ----------------------------------------------------------------------------
 * เหตุผล (ผลตรวจ Task 43): พบเวอร์ชันเบี่ยงกัน 5 ค่าในระบบเดียวกัน —
 *   SelfTest v5.5.1 / ไฟล์ upload 04_GeoService v5.5.4 / README v5.5.6 /
 *   โฟลเดอร์ GAS v5.5.7 / patch v5.5.8 → ไม่มีที่เดียวที่ "ชี้ขาด"
 *   ว่าขณะนี้รันโค้ดชุดไหน
 * อัปเดต Task 45: ชุดล้างข้อมูลฉบับ GAS ล้วน (9 ไฟล์ 50-58) เข้ามาถึง
 *   หลังครบ → ปั๊มเป็น v5.6.0-task45
 * ============================================================================
 */

// ============================================
//  SCRIPT VERSION (single source of truth)
// ============================================
// ★ แก้ค่านี้ที่เดียว ทุกครั้งที่แก้โค้ดไฟล์ใดก็ตาม แล้วกดบันทึก
//   รูปแบบ: <เวอร์ชันหลัก>-<งานล่าสุด> เช่น v5.6.1-task46
const SCRIPT_VERSION = 'v5.6.0-task45';

/** อ่านเวอร์ชันปัจจุบัน (ใช้ใน SelfTest / log / เมนู) */
function getScriptVersion_() {
  return SCRIPT_VERSION;
}

/** ปั๊มเวอร์ชันลง Properties ตอน deploy
 *  รันครั้งเดียวหลังวางโค้ดใหม่: กดรันฟังก์ชันนี้ในเอดิเตอร์ */
function stampScriptVersion() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SCRIPT_VERSION', SCRIPT_VERSION);
  props.setProperty('SCRIPT_VERSION_STAMPED_AT', new Date().toISOString());
  Logger.log('Stamped SCRIPT_VERSION = ' + SCRIPT_VERSION +
    ' — ครบชุด: GeoService v5.5.8 + แพตช์ cleanThai/SelfTest + CLEANUP 50-58');
}

/* ============================================================================
 *  การตรวจรับหลังวางชุด Task 45:
 *   1) วาง 9 ไฟล์ CLEANUP (50-58) + แพตช์ cleanThai + แพตช์ SelfTest
 *      + deploy 04_GeoService_v5.5.8.gs พร้อมกัน
 *   2) รัน stampScriptVersion() หนึ่งครั้ง
 *   3) รีเฟรชชีต → เมนู CLEANUP MASTER ขึ้น → รัน "0. ตรวจสถานะ + สำรอง"
 *      ตัวเลขที่คาด (snapshot 09-22): O≠W 383 | เขตเขต 6,449 | PII 834
 *   4) รัน Self-Test ใหม่ — ผลที่คาด: 9 การทดสอบ ไม่มี FAIL ภาษาผิดสาย
 * ============================================================================ */
