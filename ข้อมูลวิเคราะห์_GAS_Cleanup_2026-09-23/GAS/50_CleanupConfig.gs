/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Google Apps Script ล้วน (ไม่ใช้ Python)
 * Task 45 · 2026-09-23 · พอร์ตจาก scripts/master_cleanup/ (Python, Task 44)
 * ============================================================================
 * ไฟล์: 50_CleanupConfig.gs — ค่าตั้งต้น + แผนที่คอลัมน์ + ตัวช่วยชีต/บันทึก
 *
 * วิธีติดตั้ง (สรุป — ดู README_GAS_วิธีใช้.txt ประกอบ):
 *   1) เปิด Extensions → Apps Script ของสเปรดชีต MASTER_PLACE
 *   2) สร้างไฟล์ใหม่ชื่อ 50_CleanupConfig.gs … 58_CleanupMenu.gs (9 ไฟล์)
 *      แล้ววางโค้ดทีละไฟล์ (ชื่อไฟล์ต้องตรงตามหัวไฟล์)
 *   3) เพิ่ม 1 บรรทัดใน onOpen ของ 03_Menu.gs:
 *        try { addCleanupMenu_(); } catch (e) { Logger.log(e); }
 *   4) รีเฟรชสเปรดชีต — จะเห็นเมนู "CLEANUP MASTER"
 *
 * หลักการเหล็ก (สืบทอดจาก Task 43-44):
 *   1) ห้าม rerun ปุ่ม 3/3b ทั้งชีต — แถวที่มี GEO_LAYER ถูก skip อยู่แล้ว
 *   2) แพตช์ cleanThai (GAS_patches/) ต้องวาง "ก่อนหรือพร้อม" กับเฟส 1
 *      — สคริปต์เฟส 1 จะตรวจให้เอง (gate) แล้วหยุดถ้ายังไม่วาง
 *   3) ห้ามแตะ UPDATED_AT — ใช้คอลัมน์ CLEANUP_DATE แยกเส้น
 *   4) ทุกเฟสมีโหมดตรวจอย่างเดียว (dry-run) ก่อนทำจริงเสมอ
 *   5) ทุกสคริปต์ idempotent — รันซ้ำผลเหมือนเดิม
 * ============================================================================
 */

var CLEANUP_VERSION = 'v5.6.0-task45';

/** ค่าตั้งต้นของชุดล้างข้อมูล — แก้ได้ตามจริง */
var CLEANUP_CFG = {
  MASTER_SHEET: 'MASTER_PLACE',   // ชื่อแท็บ MASTER (ถ้าไม่เจอ → auto-detect จากหัวคอลัมน์)
  GEO_SHEET: 'SYS_TH_GEO',        // ชื่อแท็บพจนานุกรม (ถ้าไม่เจอ → auto-detect)
  K: 15,                           // จำนวนเพื่อนบ้าน kNN (เทียบเท่า Python)
  MIN_VOTES: 3,                    // เสียงขั้นต่ำของการโหวต
  FAR_KM: 5.0,                     // เพื่อนบ้านไกลสุดเกิน 5 กม. = ชนบท/ตรวจมือ
  LOG_SHEET: 'CLEANUP_LOG',        // แท็บบันทึกการรัน (เทียบเท่า run_manifest.jsonl)
  STATUS_SHEET: 'CLEANUP_STATUS',  // แท็บผลตรวจ preflight
  REVIEW_ROW_LIMIT: 0              // 0 = เขียนรายงานเต็มทุกแถว
};

/** แผนที่คอลัมน์ MASTER_PLACE — semantic → ชื่อหัวคอลัมน์จริงบนชีต */
var CLEANUP_COLS = {
  MD_ID: 'MD_ID',
  MATCH_KEY: 'MATCH_KEY',
  NAME: 'NAME_CLEAN',
  ADDR: 'ADDR_CLEAN',
  OWNER: 'OWNER_CLEAN',
  LAT: 'LAT',
  LNG: 'LNG',
  POINTS: 'POINTS',
  FIRST_SEEN: 'FIRST_SEEN',
  LAST_SEEN: 'LAST_SEEN',
  STATUS: 'STATUS',
  RAW_NAMES: 'RAW_NAMES',
  RAW_ADDRS: 'RAW_ADDRS',
  N: 'PROVINCE',            // ฝั่งปุ่ม 1 (ที่อยู่พิมพ์ ไทย)
  O: 'AMPHOE',              // ฝั่งปุ่ม 1
  U: 'Rahatpraisanee',      // ฝั่งปุ่ม 3 — ไปรษณีย์
  V: 'Changwat',
  W: 'Amphoe_Khet',
  X: 'Tambon_Kwaeng',
  Y: 'Reversegeocode',
  AA: 'GEO_LAYER',
  UPDATED: 'UPDATED_AT'
};

/** คอลัมน์ใหม่ที่เฟส 1 เพิ่มต่อท้าย (ตำแหน่ง AB/AC ตามลำดับคอลัมน์ปัจจุบัน) */
var CLEANUP_NEW_COLS = ['PHONE_EXTRACTED', 'CLEANUP_DATE'];

/** คอลัมน์ที่ต้องมีก่อนเริ่มงาน */
var CLEANUP_REQUIRED = ['MD_ID', 'MATCH_KEY', 'NAME', 'ADDR', 'OWNER', 'LAT', 'LNG',
  'STATUS', 'N', 'O', 'U', 'V', 'W', 'X', 'Y', 'AA', 'UPDATED'];

/* ==========================================================================
 *  ตัวช่วยระดับชีต — หาชีต / หัวคอลัมน์ / แท็บรายงาน / บันทึก
 * ========================================================================== */

/** หาชีต MASTER: ตามชื่อก่อน ถ้าไม่เจอ auto-detect จากหัวคอลัมน์ */
function cleanupGetMasterSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLEANUP_CFG.MASTER_SHEET);
  if (sh) return sh;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    if (s.getLastRow() < 1 || s.getLastColumn() < 5) continue;
    var hdr = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 40)).getValues()[0];
    var names = hdr.map(function (h) { return String(h || '').trim(); });
    if (names.indexOf('MD_ID') >= 0 && names.indexOf('MATCH_KEY') >= 0 &&
        names.indexOf('GEO_LAYER') >= 0) {
      Logger.log('[CLEANUP] auto-detect MASTER = ' + s.getName());
      return s;
    }
  }
  throw new Error('ไม่พบชีต MASTER (ลองแก้ CLEANUP_CFG.MASTER_SHEET ให้ตรงชื่อแท็บจริง)');
}

/** หาชีตพจนานุกรม SYS_TH_GEO (ใช้เฉพาะเฟส 2 — เสริมไปรษณีย์เมื่อโหวตน้อย) */
function cleanupGetGeoSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLEANUP_CFG.GEO_SHEET);
  if (sh) return sh;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    if (s.getLastRow() < 1 || s.getLastColumn() < 5) continue;
    var hdr = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 40)).getValues()[0];
    var names = hdr.map(function (h) { return String(h || '').trim(); });
    if (names.indexOf('อำเภอ_clean') >= 0 && names.indexOf('รหัสไปรษณีย์') >= 0) {
      Logger.log('[CLEANUP] auto-detect GEO dict = ' + s.getName());
      return s;
    }
  }
  return null; // ไม่มี → เฟส 2 จะตั้งธง U_KEEP_REVIEW แทน (ไม่พังงาน)
}

/** อ่าน/สร้างแท็บ (แทนที่ของเดิมทั้งแท็บ) สำหรับรายงาน — คืนชีต */
function cleanupReportTab_(name, headers, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (sh) { ss.deleteSheet(sh); }
  sh = ss.insertSheet(name);
  var nCol = headers.length;
  var out = [headers];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var line = [];
    for (var c = 0; c < nCol; c++) { line.push(r[c] === undefined ? '' : r[c]); }
    out.push(line);
  }
  sh.getRange(1, 1, out.length, nCol).setValues(out);
  sh.getRange(1, 1, 1, nCol).setFontWeight('bold').setBackground('#eeeeee');
  sh.setFrozenRows(1);
  return sh;
}

/** อ่านแท็บรายงานเดิมกลับมาเป็น {headers, rows} หรือ null ถ้าไม่มี */
function cleanupReadReportTab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  var headers = vals[0].map(function (h) { return String(h || '').trim(); });
  var rows = vals.slice(1);
  return { sheet: sh, headers: headers, rows: rows };
}

/** บันทึกการรันลงแท็บ CLEANUP_LOG (เทียบเท่า run_manifest.jsonl) */
function cleanupLog_(phase, status, detailObj) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CLEANUP_CFG.LOG_SHEET);
    if (!sh) {
      sh = ss.insertSheet(CLEANUP_CFG.LOG_SHEET);
      sh.getRange(1, 1, 1, 4).setValues([['เวลา', 'เฟส', 'สถานะ', 'รายละเอียด']])
        .setFontWeight('bold').setBackground('#eeeeee');
      sh.setFrozenRows(1);
    }
    var detail = '';
    try { detail = JSON.stringify(detailObj || {}); } catch (e) { detail = String(detailObj); }
    sh.appendRow([new Date(), phase, status, detail]);
  } catch (e) {
    Logger.log('[CLEANUP] log ล้มเหลว: ' + e.message);
  }
}

/** วันที่วันนี้รูปแบบ yyyy-MM-dd — ใช้เป็นค่า CLEANUP_DATE */
function cleanupTodayTag_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** แสดง toast (กัน error เมื่อไม่มี UI เช่น รันจาก trigger) */
function cleanupToast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'CLEANUP ' + CLEANUP_VERSION, 20); }
  catch (e) { Logger.log('[CLEANUP] ' + msg); }
}

/** ปุ่มยืนยันก่อนทำจริง — คืน true เมื่อกด YES (หรือไม่มี UI) */
function cleanupConfirm_(title, msg) {
  try {
    var ui = SpreadsheetApp.getUi();
    return ui.alert(title, msg, ui.ButtonSet.YES_NO) === ui.Button.YES;
  } catch (e) {
    return true; // ไม่มี UI (รันจากโค้ด/trigger) — ปล่อยผ่าน
  }
}

/** คล็อกกันรันซ้อน */
function cleanupWithLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('มีการรันชุดล้างข้อมูลอยู่แล้ว — รอให้จบก่อนแล้วลองอีกครั้ง');
  }
  try { return fn(); } finally { lock.releaseLock(); }
}
