/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 58_CleanupMenu.gs — เมนูรวม + สำรองทั้งไฟล์ + กู้คืน + เกี่ยวกับ
 * ============================================================================
 * การติดตั้งเมนู: เพิ่ม 1 บรรทัดนี้ใน onOpen ของไฟล์ 03_Menu.gs (ในวงเล็บ
 * ของฟังก์ชัน onOpen ที่มีอยู่แล้ว — ห้ามสร้าง onOpen ซ้ำ):
 *     try { addCleanupMenu_(); } catch (e) { Logger.log(e); }
 * รีเฟรชสเปรดชีต 1 ครั้ง → เมนู "CLEANUP MASTER" จะขึ้นข้างเมนูเดิม
 * (หรือรัน addCleanupMenu_() เองจากเอดิเตอร์ก็ได้ — เมนูอยู่ถึงปิดไฟล์)
 * ============================================================================
 */

/** สร้างเมนู CLEANUP MASTER (เรียกจาก onOpen หรือรันเองได้) */
function addCleanupMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('CLEANUP MASTER ' + CLEANUP_VERSION)
    .addItem('0. ตรวจสถานะ + สำรอง (รันก่อนเสมอ)', 'uiCleanupPhase0')
    .addItem('0b. ตรวจอย่างเดียว ไม่สำรอง', 'uiCleanupPhase0NoBackup')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 1 — เขตเขต + PII')
      .addItem('ตรวจอย่างเดียว (dry-run)', 'uiCleanupPhase1Dry')
      .addItem('ทำจริง — ล้าง + PHONE_EXTRACTED', 'uiCleanupPhase1Apply')
      .addItem('รวมแถวซ้ำ (ตาม P1_DUP ที่ตั้ง Y)', 'uiCleanupMergeDuplicates'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 2 — kNN แก้คอลัมน์ราชการ')
      .addItem('ตรวจอย่างเดียว (dry-run)', 'uiCleanupPhase2Dry')
      .addItem('ทำจริง — 106 แถว → KNN_FIX', 'uiCleanupPhase2Apply')
      .addItem('ค้นหาข้อความทุกชีต (เช่น ed08ffce)', 'uiCleanupFindTextUi'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 3 — เติม PROVINCE/AMPHOE')
      .addItem('ตรวจอย่างเดียว (dry-run)', 'uiCleanupPhase3Dry')
      .addItem('ทำจริง — เติมแถว CONSISTENT', 'uiCleanupPhase3Apply'))
    .addItem('เฟส 4 — สร้างแพ็กเกจ SCG (4 แท็บ)', 'uiCleanupPhase4')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 5 — ส่งออกไฟล์เบา <3MB')
      .addItem('เฉพาะแถวปัญหา → Drive (แนะนำ)', 'uiCleanupPhase5Rows')
      .addItem('ทั้งชีต ตัดคอลัมน์ RAW → Drive', 'uiCleanupPhase5Cols')
      .addItem('รวมทุกแท็บรายงานเป็น zip → Drive', 'uiCleanupPhase5Zip'))
    .addSeparator()
    .addItem('สำรองทั้งไฟล์ไป Drive (แนะนำก่อนทำจริงครั้งแรก)', 'uiCleanupBackupDrive')
    .addItem('กู้คืน MASTER จากแท็บสำรอง', 'uiCleanupRestore')
    .addItem('เกี่ยวกับชุดนี้', 'uiCleanupAbout')
    .addToUi();
}

/** สำรองทั้งไฟล์สเปรดชีต (ทุกชีต ทุกสูตร) ไป Google Drive */
function uiCleanupBackupDrive() {
  try {
    var url = clBackupWholeFile_();
    cleanupLog_('util', 'BACKUP_FILE', { url: url });
    cleanupToast_('สำรองทั้งไฟล์แล้ว: ' + url);
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('สำรองไฟล์ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

/** กู้คืน MASTER จากแท็บสำรอง BK_MASTER_* */
function uiCleanupRestore() {
  try {
    var list = clListBackupTabs_();
    if (list.length === 0) {
      throw new Error('ยังไม่มีแท็บสำรอง BK_MASTER_* — รันเฟส 0 ก่อน');
    }
    var msg = 'แท็บสำรองที่มี (ใหม่สุดก่อน):\n' +
      list.slice(0, 10).map(function (s, i) { return '  ' + (i + 1) + '. ' + s; }).join('\n') +
      '\n\nพิมพ์หมายเลขหรือชื่อแท็บที่ต้องการกู้คืน:';
    var ui = SpreadsheetApp.getUi();
    var resp = ui.prompt('กู้คืน MASTER', msg, ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    var ans = resp.getResponseText().trim();
    var pick = ans;
    if (/^\d+$/.test(ans)) {
      var k = parseInt(ans, 10) - 1;
      if (k < 0 || k >= list.length) throw new Error('หมายเลขไม่ถูกต้อง');
      pick = list[k];
    }
    if (!clBackupMasterTab_()) { /* สำรองสถานะปัจจุบันก่อนกู้คืน */ }
    var r = clRestoreMasterFromTab_(pick);
    cleanupLog_('util', 'RESTORE', { from: pick, rows: r.rows, cols: r.cols });
    cleanupToast_('กู้คืนจาก ' + pick + ' แล้ว (' + r.rows + ' แถว) — สถานะก่อนกู้คืนสำรองไว้แท็บ BK ใหม่แล้ว');
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('กู้คืนผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupAbout() {
  var msg =
    'ชุดล้างข้อมูล MASTER_PLACE — GAS ล้วน ' + CLEANUP_VERSION + '\n' +
    'พอร์ตจาก Python Cleanup Toolkit (Task 44) เป็น Apps Script เต็มชุด\n\n' +
    'ลำดับใช้งาน: 0 → 1 → 1c(ถ้ามีซ้ำ) → 2 → 3 → 4 → 5\n' +
    '· ทุกเฟสรัน "ตรวจอย่างเดียว" ก่อนดูตัวเลขในแท็บรายงาน\n' +
    '· เฟส 1 ทำจริงต้องวางแพตช์ cleanThai ก่อน (โค้ดตรวจให้)\n' +
    '· ห้าม rerun ปุ่ม 3/3b ทั้งชีต — ไม่ช่วยและเป็น no-op\n' +
    '· UPDATED_AT ไม่ถูกแตะ — ใช้ CLEANUP_DATE แยกเส้น\n' +
    '· ทุกเฟส idempotent — รันซ้ำผลเหมือนเดิม\n\n' +
    'ไฟล์: 50_Config / 51_Lib / 52-57_Phase0-5 / 58_Menu\n' +
    'แพตช์ที่ต้องวางคู่: GAS_patches/ (cleanThai + SelfTest + SCRIPT_VERSION)';
  try { SpreadsheetApp.getUi().alert('เกี่ยวกับ CLEANUP MASTER', msg, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { Logger.log(msg); }
}
