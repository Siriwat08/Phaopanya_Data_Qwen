/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45 · rev.2 (Task 47-48)
 * ไฟล์: 58_CleanupMenu.gs — เมนูรวม + สำรองทั้งไฟล์ + กู้คืน + เกี่ยวกับ
 * ============================================================================
 * การติดตั้งเมนู: เพิ่ม 1 บรรทัดนี้ใน onOpen ของไฟล์ 03_Menu.gs (ในวงเล็บ
 * ของฟังก์ชัน onOpen ที่มีอยู่แล้ว — ห้ามสร้าง onOpen ซ้ำ):
 *     try { addCleanupMenu_(); } catch (e) { Logger.log(e); }
 * รีเฟรชสเปรดชีต 1 ครั้ง → เมนู "CLEANUP MASTER" จะขึ้นข้างเมนูเดิม
 * (หรือรัน addCleanupMenu_() เองจากเอดิตอร์ก็ได้ — เมนูอยู่ถึงปิดไฟล์)
 *
 * ★ rev.2 ลำดับเมนูเรียงตามความเสี่ยงจริง (ฉันทามติตรวจ 3 ฝ่าย):
 *   แก้ geo ก่อน (เฟส 2 มีนำร่อง) → ล้างข้อความ (1a) → เติม/รายงาน (3/4/5)
 *   → ย้าย key + ดัชนี (1b — ท้ายสุด เพราะแตะหัวใจระบบมากที่สุด)
 * ============================================================================
 */

/** สร้างเมนู CLEANUP MASTER (เรียกจาก onOpen หรือรันเองได้) */
function addCleanupMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('CLEANUP MASTER r2')
    .addItem('0. ตรวจสถานะ + สำรอง (รันก่อนเสมอ)', 'uiCleanupPhase0')
    .addItem('0b. ตรวจอย่างเดียว ไม่สำรอง', 'uiCleanupPhase0NoBackup')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 2 — kNN แก้คอลัมน์ราชการ (ทำก่อน)')
      .addItem('ตรวจอย่างเดียว (dry-run) → P2_FIX มี MAPS_URL', 'uiCleanupPhase2Dry')
      .addItem('★ นำร่อง 10 แถวแรก (แถวแรก = MD-0003)', 'uiCleanupPhase2Pilot')
      .addItem('ทำจริง — เฉพาะแถวที่ผ่านธง → KNN_FIX', 'uiCleanupPhase2Apply')
      .addItem('ค้นหาข้อความทุกชีต (เช่น ed08ffce)', 'uiCleanupFindTextUi'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 1a — ล้างเขตเขต + PII (ไม่แตะ key)')
      .addItem('ตรวจอย่างเดียว (dry-run)', 'uiCleanupPhase1Dry')
      .addItem('ทำจริง — ล้าง + PHONE_EXTRACTED', 'uiCleanupPhase1Apply'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 3 — เติม PROVINCE/AMPHOE')
      .addItem('ตรวจอย่างเดียว (dry-run)', 'uiCleanupPhase3Dry')
      .addItem('ทำจริง — เติมแถว CONSISTENT', 'uiCleanupPhase3Apply'))
    .addItem('เฟส 4 — สร้างแพ็กเกจ SCG (4 แท็บ)', 'uiCleanupPhase4')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 5 — ส่งออกไฟล์เบา <3MB')
      .addItem('เฉพาะแถวปัญหา → Drive (แนะนำ)', 'uiCleanupPhase5Rows')
      .addItem('ทั้งชีต ตัดคอลัมน์ RAW → Drive', 'uiCleanupPhase5Cols')
      .addItem('รวมทุกแท็บรายงานเป็น zip → Drive', 'uiCleanupPhase5Zip'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('เฟส 1b — ย้าย MATCH_KEY + ซ่อม IDX (ท้ายสุด!)')
      .addItem('ตรวจอย่างเดียว (dry-run) — เห็น P1B_REVIEW + P1_DUP', 'uiCleanupPhase1bDry')
      .addItem('1c. รวมแถวซ้ำ (ตาม P1_DUP ที่ตั้ง Y)', 'uiCleanupMergeDuplicates')
      .addItem('ทำจริง — key + ซ่อม IDX + ทดสอบ (ต้องวางแพตช์ cleanThai ก่อน)', 'uiCleanupPhase1bApply'))
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
    'rev.2 — รับข้อตรวจจาก AI อีก 3 ฝ่าย + code review ตัวเอง\n\n' +
    '★ ลำดับ rev.2: 0 → 2 (นำร่อง 10 ก่อนทำจริง) → 1a → 3 → 4 → 5 → 1b\n' +
    '· ทุกเฟสรัน "ตรวจอย่างเดียว" ก่อน แล้วดูตัวเลขในแท็บรายงาน\n' +
    '· เฟส 2 ทำจริงเฉพาะแถวที่ผ่านธง — ติดธง (KNN_THIN/KNN_FAR/\n' +
    '  NV_CONFLICT/โหวตอ่อน) = คิวตรวจมือ ใช้คอลัมน์ MAPS_URL เทียบตา\n' +
    '· เฟส 1a ไม่แตะ MATCH_KEY — ปลอดภัยเดี่ยว ๆ\n' +
    '· เฟส 1b (ท้ายสุด) ย้าย key ด้วย makeKey ของระบบ + ซ่อม\n' +
    '  SYS_MASTER_IDX + ลบ ghost + ทดสอบการค้น ครบในกดเดียว\n' +
    '  ต้องวางแพตช์ cleanThai วันเดียวกัน (โค้ดบังคับ)\n' +
    '· ห้าม rerun ปุ่ม 3/3b ทั้งชีต — ไม่ช่วยและเป็น no-op\n' +
    '· UPDATED_AT ไม่ถูกแตะ — ใช้ CLEANUP_DATE แยกเส้น\n' +
    '· ทุกเฟส idempotent — รันซ้ำผลเหมือนเดิม\n\n' +
    'ไฟล์: 50_Config / 51_Lib / 52-57_Phase0-5 / 58_Menu / 59_Phase1b\n' +
    'แพตช์ที่ต้องวาง: cleanThai (พร้อม 1b) + SelfTest + SCRIPT_VERSION + FIX-A';
  try { SpreadsheetApp.getUi().alert('เกี่ยวกับ CLEANUP MASTER r2', msg, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { Logger.log(msg); }
}
