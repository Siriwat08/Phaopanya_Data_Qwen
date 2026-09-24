/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45 · rev.2 (Task 47-48)
 * ไฟล์: 53_CleanupPhase1.gs — เฟส 1a: ล้างคำนำหน้าซ้ำ (เขตเขต/แขวงแขวง) + ตัด PII
 * พอร์ตจาก cleanup_1_prefix_pii.py — ทำงานตรงบนชีต (ไม่ต้อง paste ย้อนกลับ)
 * ============================================================================
 * ★ rev.2 เปลี่ยนสำคัญ: เฟส 1 ถูกแยกเป็น 2 ส่วน — ไฟล์นี้คือ "1a"
 *   1a (ไฟล์นี้)  : ล้าง NAME/ADDR/OWNER + เพิ่ม PHONE_EXTRACTED/CLEANUP_DATE
 *                   ★ ไม่เขียน MATCH_KEY เด็ดขาด — ย้ายไปเฟส 1b (59_*.gs)
 *   1b (59_*.gs)  : ย้าย MATCH_KEY + ซ่อม SYS_MASTER_IDX + ทดสอบการค้น
 *                   — ต้องวางแพตช์ cleanThai "วันเดียวกัน" (โค้ดบังคับ)
 *
 *   เหตุผล (พิสูจน์จากโค้ด production จริง 01_MasterService.gs):
 *   - ปุ่ม 1 เมื่อเจอแถวเดิม (match) เขียนเฉพาะ POINTS/LAT/LNG/LAST_SEEN/
 *     UPDATED_AT และ N/O เมื่อ geo แมตช์ — ไม่เขียนทับ NAME/ADDR เดิม
 *     → ล้างข้อความเดี่ยว ๆ ไม่ถูกระบบรายวันทำลาย และ MATCH_KEY เดิม
 *     ยังตรงกับ SYS_MASTER_IDX เหมือนเดิม → ปุ่ม 2 ทำงานต่อเนื่อง
 *   - แต่การ "เปลี่ยน MATCH_KEY" ต้องรอวางแพตช์ cleanThai พร้อมกัน
 *     ไม่งั้น key ฝั่ง MASTER กับฝั่งข้อมูลใหม่ (makeKey) จะเบี่ยงกัน
 *     → ปุ่ม 1 สร้างแถวซ้ำ — งานนี้จึงถูกย้ายออกไปเฟส 1b ท้ายสุด
 *
 * ทำอะไร (1a):
 *   1) ADDR_CLEAN : รวมคำนำหน้าซ้ำ + ตัดเบอร์ (ถ้ามี)
 *   2) NAME_CLEAN : ตัดเบอร์โทร → เก็บหลักฐานในคอลัมน์ใหม่ PHONE_EXTRACTED
 *   3) OWNER_CLEAN: ตัดเบอร์ (ถ้ามี)
 *   4) CLEANUP_DATE: วันที่ล้าง (แถวที่มีหลักฐานใหม่เท่านั้น) — ไม่แตะ UPDATED_AT
 *   5) MATCH_KEY  : ★ ไม่แตะ (คง key เดิม — รอเฟส 1b)
 *
 * หมายเหตุ: ข้อมูลใหม่ที่ไหลเข้าระหว่าง 1a กับ 1b อาจยังมีเขตเขต/เบอร์
 *   (cleanThai เดิมยังไม่มีกฎใหม่) → รัน 1a ซ้ำได้เสมอ (idempotent)
 *   และควรทำ 1a → 1b ให้ใกล้กัน (วันเดียวกันหรือไม่กี่วัน)
 *
 * ตัวเลขจากการรันจริง (snapshot 2026-09-22): NAME 957 | ADDR 6,459 |
 *   OWNER 0 | มีเบอร์ถูกตัด 973 | แถวที่ถูกล้างรวม 6,708
 * ============================================================================
 */

/**
 * เฟส 1a — ล้างเขตเขต + PII (ไม่แตะ MATCH_KEY)
 * @param {boolean} apply false = dry-run (เขียนเฉพาะแท็บรายงาน) / true = เขียนชีตจริง
 * @return {Object} สรุปตัวเลข
 */
function cleanupPhase1(apply) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;

  // ---- สถานะแพตช์ cleanThai (แค่รายงาน — เฟส 1a ไม่บังคับ) ----
  var patch = clCheckCleanThaiPatch_();

  // ---- ค่า audit เดิม (idempotent: รันซ้ำคงค่าหลักฐานเดิม) ----
  var oldExt = clOldAudit_(ctx, 'PHONE_EXTRACTED');
  var oldDate = clOldAudit_(ctx, 'CLEANUP_DATE');
  var runTag = cleanupTodayTag_();

  // ---- ล้างทีละแถว ----
  var newName = [], newAddr = [], newOwner = [],
      phoneExt = [], changedRows = 0;
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var nm = clStr_(row[c.NAME]);
    var ad = clStr_(row[c.ADDR]);
    var ow = clStr_(row[c.OWNER]);

    var ext = [];
    var nm2 = clCleanAll_(nm);
    if (nm2 !== nm) {
      var toksN = clExtractPhones_(nm);
      for (var t = 0; t < toksN.length; t++) ext.push('NAME=' + toksN[t]);
    }
    var ad2 = clCleanAll_(ad);
    if (ad2 !== ad) {
      var toksA = clExtractPhones_(ad);
      for (var t2 = 0; t2 < toksA.length; t2++) ext.push('ADDR=' + toksA[t2]);
    }
    var ow2 = clCleanAll_(ow);
    if (ow2 !== ow) {
      var toksO = clExtractPhones_(ow);
      for (var t3 = 0; t3 < toksO.length; t3++) ext.push('OWNER=' + toksO[t3]);
    }
    if (nm2 !== nm || ad2 !== ad || ow2 !== ow) changedRows++;

    phoneExt.push(ext.join('; '));
    newName.push(nm2);
    newAddr.push(ad2);
    newOwner.push(ow2);
  }

  // ---- คอลัมน์ audit สุดท้าย (คงค่าหลักฐานเดิมถ้ารอบนี้ไม่มีของใหม่) ----
  var finalExt = [], finalDate = [];
  var nPhone = 0;
  for (var i = 0; i < n; i++) {
    var e = phoneExt[i] !== '' ? phoneExt[i] : oldExt[i];
    finalExt.push(e);
    finalDate.push(phoneExt[i] !== '' ? runTag : oldDate[i]);
    if (e !== '') nPhone++;
  }

  // ---- นับการเปลี่ยนแปลง (ข้อความเท่านั้น — key ไม่ถูกแตะในเฟสนี้) ----
  var nName = 0, nAddr = 0, nOwner = 0;
  var changedIdx = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var ch = false;
    if (newName[i] !== clStr_(row[c.NAME])) { nName++; ch = true; }
    if (newAddr[i] !== clStr_(row[c.ADDR])) { nAddr++; ch = true; }
    if (newOwner[i] !== clStr_(row[c.OWNER])) { nOwner++; ch = true; }
    if (ch) changedIdx.push(i);
  }

  // ---- แท็บรายงานแถวที่เปลี่ยน (ตรวจก่อน/หลัง — ไม่มีคอลัมน์ key แล้ว) ----
  var limit = CLEANUP_CFG.REVIEW_ROW_LIMIT > 0 ? CLEANUP_CFG.REVIEW_ROW_LIMIT : changedIdx.length;
  var rev = [];
  for (var j = 0; j < changedIdx.length && j < limit; j++) {
    var i = changedIdx[j];
    var row = vals[i];
    rev.push([i + 2, clStr_(row[c.MD_ID]),
      clStr_(row[c.NAME]), newName[i],
      clStr_(row[c.ADDR]), newAddr[i],
      clStr_(row[c.OWNER]), newOwner[i],
      finalExt[i], finalDate[i]]);
  }
  cleanupReportTab_('P1_REVIEW', ['ROW', 'MD_ID',
    'NAME_OLD', 'NAME_NEW', 'ADDR_OLD', 'ADDR_NEW', 'OWNER_OLD', 'OWNER_NEW',
    'PHONE_EXTRACTED', 'CLEANUP_DATE'], rev);

  // ---- สรุป ----
  var summary = {
    apply: apply, rows: n, changedName: nName, changedAddr: nAddr,
    changedOwner: nOwner, changedRows: changedRows,
    piiRows: nPhone, cleanThaiPatch: patch.ok,
    matchKeyTouched: false, seconds: Math.round((new Date() - t0) / 1000)
  };

  // ---- ทำจริง: เขียน 5 คอลัมน์ (NAME/ADDR/OWNER + audit) — ไม่มี MATCH_KEY ----
  if (apply) {
    var auditCols = clEnsureAuditColumns_(ctx);
    // ตรวจสูตรในคอลัมน์เป้าหมาย ก่อนเขียน
    var targets = [c.NAME, c.ADDR, c.OWNER,
      ctx.headers.indexOf('PHONE_EXTRACTED'), ctx.headers.indexOf('CLEANUP_DATE')];
    var bad = clFindFormulas_(ctx, targets);
    if (bad.length) {
      cleanupLog_(1, 'ABORT_FORMULA', { cells: bad });
      throw new Error('พบสูตรในคอลัมน์เป้าหมาย — ยกเลิกกันทับสูตร: ' + bad.join(', '));
    }
    clWriteColumn_(ctx, c.NAME, newName);
    clWriteColumn_(ctx, c.ADDR, newAddr);
    clWriteColumn_(ctx, c.OWNER, newOwner);
    clWriteColumn_(ctx, ctx.headers.indexOf('PHONE_EXTRACTED'), finalExt);
    clWriteColumn_(ctx, ctx.headers.indexOf('CLEANUP_DATE'), finalDate);
  }

  cleanupLog_(1, apply ? 'OK' : 'DRYRUN', summary);
  cleanupToast_('เฟส 1a ' + (apply ? '(ทำจริง)' : '(dry-run)') +
    ': NAME ' + nName + ' | ADDR ' + nAddr +
    ' | PII ' + nPhone + ' | MATCH_KEY ไม่ถูกแตะ (รอเฟส 1b)' +
    ' | แท็บ P1_REVIEW ' + rev.length + ' แถว' +
    ' | ' + summary.seconds + ' วิ');
  return summary;
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase1Dry() {
  try {
    cleanupWithLock_(function () { return cleanupPhase1(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1a (dry-run) ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase1Apply() {
  try {
    cleanupWithLock_(function () {
      var patch = clCheckCleanThaiPatch_();
      var msg = 'ทำจริงเฟส 1a: ล้างเขตเขต + ตัด PII บนชีต MASTER โดยตรง\n\n' +
        '★ MATCH_KEY ไม่ถูกแตะ (ต่างจากฉบับแรก) — ปลอดภัยเดี่ยว ๆ\n' +
        '   การย้าย key + ซ่อม SYS_MASTER_IDX อยู่ที่เฟส 1b (ทำท้ายสุด)\n\n' +
        'แพตช์ cleanThai: ' + (patch.ok ? 'วางแล้ว (ผ่าน)' :
          'ยังไม่วาง — เฟส 1a ทำได้ปกติ (ไม่บังคับ)\n   จะบังคับเฉพาะเฟส 1b') + '\n' +
        'คอลัมน์ที่เขียน: NAME/ADDR/OWNER + PHONE_EXTRACTED + CLEANUP_DATE\n' +
        'ไม่แตะ UPDATED_AT / MATCH_KEY · แนะนำรันเฟส 0 (สำรอง) ก่อน\n\nยืนยันทำจริง?';
      if (!cleanupConfirm_('เฟส 1a — ทำจริง (ล้างข้อความ)', msg)) return 'ยกเลิก';
      return cleanupPhase1(true);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1a ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
