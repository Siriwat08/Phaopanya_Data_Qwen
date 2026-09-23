/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 53_CleanupPhase1.gs — เฟส 1: ล้างคำนำหน้าซ้ำ (เขตเขต/แขวงแขวง) + ตัด PII เบอร์โทร
 * พอร์ตจาก cleanup_1_prefix_pii.py — ทำงานตรงบนชีต (ไม่ต้อง paste ย้อนกลับ)
 * ============================================================================
 * ทำอะไร:
 *   1) ADDR_CLEAN : รวมคำนำหน้าซ้ำ + ตัดเบอร์ (ถ้ามี)
 *   2) NAME_CLEAN : ตัดเบอร์โทร → เก็บหลักฐานในคอลัมน์ใหม่ PHONE_EXTRACTED
 *   3) OWNER_CLEAN: ตัดเบอร์ (ถ้ามี)
 *   4) MATCH_KEY  : คำนวณใหม่ = NAME|ADDR|OWNER (หลังล้าง)
 *   5) CLEANUP_DATE: วันที่ล้าง (แถวที่มีหลักฐานใหม่เท่านั้น) — ไม่แตะ UPDATED_AT
 *
 * ประตูความปลอดภัย:
 *   A) แพตช์ cleanThai (GAS_patches/00_CleanService_prefix_phone_patch.gs)
 *      ต้องวางแล้ว "ก่อน" กดทำจริง — โค้ดนี้ทดสอบพฤติกรรม cleanThai ให้เอง
 *      (กัน key สองฝั่งเบี่ยงกัน → ปุ่ม 1 จะ upsert แถวใหม่แทน merge)
 *   B) MATCH_KEY ซ้ำใหม่ > เดิม → ไม่หยุดงาน แต่เขียนแผน merge (แท็บ P1_DUP)
 *      ให้ตั้ง CONFIRM=Y แล้วใช้เมนู 1c รวมแถว
 *
 * ตัวเลขจากการรันจริง (snapshot 2026-09-22): NAME 957 | ADDR 6,459 |
 *   OWNER 0 | MATCH_KEY 6,708 | มีเบอร์ถูกตัด 973 | กลุ่มซ้ำแฝง 28 (73 แถว)
 * ============================================================================
 */

/** ทดสอบว่า cleanThai ที่วางอยู่ในโปรเจกต์เป็นรุ่นแพตช์แล้ว (2 กฎใหม่) */
function clCheckCleanThaiPatch_() {
  if (typeof cleanThai !== 'function') {
    return { ok: false, why: 'ยังไม่พบฟังก์ชัน cleanThai ในโปรเจกต์' };
  }
  try {
    var t1 = cleanThai('เขตเขตคลองเตย แขวงแขวงบางจาก');
    var t2 = cleanThai('คุณ สมชาย 089-123-4567');
    var t3 = cleanThai('บริษัท เอบีซี 2250930775');
    if (t1 !== 'เขตคลองเตย แขวงบางจาก') {
      return { ok: false, why: 'กฎรวมคำนำหน้าซ้ำยังไม่ทำงาน (ได้ผล: "' + t1 + '")' };
    }
    if (String(t2).indexOf('089') >= 0 || String(t2).indexOf('สมชาย') < 0) {
      return { ok: false, why: 'กฎตัดเบอร์โทรยังไม่ทำงาน (ได้ผล: "' + t2 + '")' };
    }
    if (String(t3).indexOf('2250930775') >= 0 || String(t3).indexOf('เอบีซี') < 0) {
      return { ok: false, why: 'กฎตัดเลขยาว 7+ หลัก (รหัส DN/พนักงาน) ยังไม่ทำงาน (ได้ผล: "' + t3 + '")' };
    }
    return { ok: true, why: '' };
  } catch (e) {
    return { ok: false, why: 'cleanThai โยน error: ' + e.message };
  }
}

/**
 * เฟส 1 — ล้างเขตเขต + PII
 * @param {boolean} apply false = dry-run (เขียนเฉพาะแท็บรายงาน) / true = เขียนชีตจริง
 * @return {Object} สรุปตัวเลข
 */
function cleanupPhase1(apply) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;

  // ---- ประตู A: แพตช์ cleanThai ต้องวางก่อนทำจริง ----
  var patch = clCheckCleanThaiPatch_();
  if (apply && !patch.ok) {
    cleanupLog_(1, 'ABORT_NO_CLEAN_THAI_PATCH', { why: patch.why });
    throw new Error('หยุดก่อน: ยังไม่วางแพตช์ cleanThai — ' + patch.why +
      '\n\nวาง GAS_patches/00_CleanService_prefix_phone_patch.gs ในไฟล์ 00_CleanService.gs' +
      ' ก่อน (กดบันทึก) แล้วค่อยกด "ทำจริง" อีกครั้ง' +
      '\n(เหตุผล: ปุ่ม 1 ต้องล้าง key ด้วยกฎเดียวกับชุดนี้ ไม่งั้นจะเกิดแถวซ้ำ)');
  }

  // ---- ค่า audit เดิม (idempotent: รันซ้ำคงค่าหลักฐานเดิม) ----
  var oldExt = clOldAudit_(ctx, 'PHONE_EXTRACTED');
  var oldDate = clOldAudit_(ctx, 'CLEANUP_DATE');
  var runTag = cleanupTodayTag_();

  // ---- ล้างทีละแถว ----
  var newName = [], newAddr = [], newOwner = [], newKey = [],
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
    newKey.push(nm2 + '|' + ad2 + '|' + ow2);
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

  // ---- นับการเปลี่ยนแปลง ----
  var nName = 0, nAddr = 0, nOwner = 0, nKey = 0;
  var changedIdx = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var ch = false;
    if (newName[i] !== clStr_(row[c.NAME])) { nName++; ch = true; }
    if (newAddr[i] !== clStr_(row[c.ADDR])) { nAddr++; ch = true; }
    if (newOwner[i] !== clStr_(row[c.OWNER])) { nOwner++; ch = true; }
    if (newKey[i] !== clStr_(row[c.MATCH_KEY])) { nKey++; ch = true; }
    if (ch) changedIdx.push(i);
  }

  // ---- ประตู B: MATCH_KEY ซ้ำใหม่ → แผน merge ----
  var oldKeys = vals.map(function (r) { return clStr_(r[c.MATCH_KEY]); });
  var baseDup = clDupKeyCount_(oldKeys);
  var newDup = clDupKeyCount_(newKey);
  var mergeGroups = 0, mergeRows = 0;
  if (newDup > baseDup) {
    var groups = {};
    for (var i = 0; i < n; i++) {
      var k = newKey[i];
      if (k) { if (!groups[k]) groups[k] = []; groups[k].push(i); }
    }
    // เรียงกลุ่มตาม key เหมือน sorted() ของ Python — เลข GROUP ตรงกับรายงานเดิม
    var groupKeys = [];
    for (var gk in groups) groupKeys.push(gk);
    groupKeys.sort();
    var plan = [];
    var gi = 0;
    for (var q = 0; q < groupKeys.length; q++) {
      var k2 = groupKeys[q];
      var idxs = groups[k2];
      if (idxs.length < 2) continue;
      gi++;
      var ptsSum = 0, fsMin = null, lsMax = null;
      var mdids = [], dnCodes = [];
      for (var j = 0; j < idxs.length; j++) {
        var r = vals[idxs[j]];
        var pts = parseFloat(r[c.POINTS]);
        if (isFinite(pts)) ptsSum += pts;
        var fs = clSortable_(r[c.FIRST_SEEN]), ls = clSortable_(r[c.LAST_SEEN]);
        if (fs !== '' && (fsMin === null || fs < fsMin)) fsMin = fs;
        if (ls !== '' && (lsMax === null || ls > lsMax)) lsMax = ls;
        mdids.push(clStr_(r[c.MD_ID]));
        var dn = finalExt[idxs[j]];
        if (dn) dnCodes.push(dn);
      }
      plan.push([gi, newKey[k2] === undefined ? k2 : k2, mdids[0], mdids.slice(1).join(';'),
        mdids.join(';'), Math.round(ptsSum), fsMin || '', lsMax || '',
        newName[idxs[0]], newAddr[idxs[0]],
        dnCodes.join('; '), '']);
      mergeRows += idxs.length;
    }
    mergeGroups = gi;
    cleanupReportTab_('P1_DUP', ['GROUP', 'NEW_MATCH_KEY', 'KEEP_MD_ID', 'DELETE_MD_ID',
      'ALL_MD_ID', 'POINTS_SUM', 'FIRST_SEEN_MIN', 'LAST_SEEN_MAX', 'NAME_NOW', 'ADDR_NOW',
      'DN_CODES_REMOVED', 'CONFIRM(Y=รวม)'], plan);
  }

  // ---- แท็บรายงานแถวที่เปลี่ยน (ตรวจก่อน/หลัง) ----
  var limit = CLEANUP_CFG.REVIEW_ROW_LIMIT > 0 ? CLEANUP_CFG.REVIEW_ROW_LIMIT : changedIdx.length;
  var rev = [];
  for (var j = 0; j < changedIdx.length && j < limit; j++) {
    var i = changedIdx[j];
    var row = vals[i];
    rev.push([i + 2, clStr_(row[c.MD_ID]),
      clStr_(row[c.NAME]), newName[i],
      clStr_(row[c.ADDR]), newAddr[i],
      clStr_(row[c.OWNER]), newOwner[i],
      clStr_(row[c.MATCH_KEY]), newKey[i],
      finalExt[i], finalDate[i]]);
  }
  cleanupReportTab_('P1_REVIEW', ['ROW', 'MD_ID',
    'NAME_OLD', 'NAME_NEW', 'ADDR_OLD', 'ADDR_NEW', 'OWNER_OLD', 'OWNER_NEW',
    'MATCH_KEY_OLD', 'MATCH_KEY_NEW', 'PHONE_EXTRACTED', 'CLEANUP_DATE'], rev);

  // ---- สรุป ----
  var summary = {
    apply: apply, rows: n, changedName: nName, changedAddr: nAddr,
    changedOwner: nOwner, changedKey: nKey, changedRows: changedRows,
    piiRows: nPhone, baseDup: baseDup, newDup: newDup,
    mergeGroups: mergeGroups, mergeRows: mergeRows,
    cleanThaiPatch: patch.ok, seconds: Math.round((new Date() - t0) / 1000)
  };

  // ---- ทำจริง: เขียน 6 คอลัมน์ (แบตช์ทั้งคอลัมน์ เร็ว) ----
  if (apply) {
    var auditCols = clEnsureAuditColumns_(ctx);
    // ตรวจสูตรในคอลัมน์เป้าหมาย ก่อนเขียน
    var targets = [c.NAME, c.ADDR, c.OWNER, c.MATCH_KEY,
      ctx.headers.indexOf('PHONE_EXTRACTED'), ctx.headers.indexOf('CLEANUP_DATE')];
    var bad = clFindFormulas_(ctx, targets);
    if (bad.length) {
      cleanupLog_(1, 'ABORT_FORMULA', { cells: bad });
      throw new Error('พบสูตรในคอลัมน์เป้าหมาย — ยกเลิกกันทับสูตร: ' + bad.join(', '));
    }
    clWriteColumn_(ctx, c.NAME, newName);
    clWriteColumn_(ctx, c.ADDR, newAddr);
    clWriteColumn_(ctx, c.OWNER, newOwner);
    clWriteColumn_(ctx, c.MATCH_KEY, newKey);
    clWriteColumn_(ctx, ctx.headers.indexOf('PHONE_EXTRACTED'), finalExt);
    clWriteColumn_(ctx, ctx.headers.indexOf('CLEANUP_DATE'), finalDate);
  }

  cleanupLog_(1, apply ? 'OK' : 'DRYRUN', summary);
  cleanupToast_('เฟส 1 ' + (apply ? '(ทำจริง)' : '(dry-run)') +
    ': NAME ' + nName + ' | ADDR ' + nAddr + ' | KEY ' + nKey +
    ' | PII ' + nPhone + ' | กลุ่มซ้ำ ' + mergeGroups +
    ' | แท็บ P1_REVIEW ' + rev.length + ' แถว' +
    ' | ' + summary.seconds + ' วิ');
  return summary;
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase1Dry() {
  try {
    cleanupWithLock_(function () { return cleanupPhase1(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1 (dry-run) ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase1Apply() {
  try {
    cleanupWithLock_(function () {
      var patch = clCheckCleanThaiPatch_();
      var msg = 'ทำจริงเฟส 1: ล้างเขตเขต + ตัด PII บนชีต MASTER โดยตรง\n\n' +
        'แพตช์ cleanThai: ' + (patch.ok ? 'วางแล้ว (ผ่าน)' : 'ยังไม่วาง — จะถูกหยุดอัตโนมัติ') + '\n' +
        'คอลัมน์ที่เขียน: NAME/ADDR/OWNER/MATCH_KEY + PHONE_EXTRACTED + CLEANUP_DATE\n' +
        'ไม่แตะ UPDATED_AT · แนะนำรันเฟส 0 (สำรอง) ก่อน\n\nยืนยันทำจริง?';
      if (!cleanupConfirm_('เฟส 1 — ทำจริง', msg)) return 'ยกเลิก';
      return cleanupPhase1(true);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

/**
 * เมนู 1c — รวมแถวซ้ำตามแท็บ P1_DUP (เฉพาะกลุ่มที่ตั้ง CONFIRM = Y)
 * กติกา: คงแถว KEEP_MD_ID → POINTS=รวม, FIRST_SEEN=เก่าสุด, LAST_SEEN=ใหม่สุด
 *         → ลบแถว DELETE_MD_ID
 */
function uiCleanupMergeDuplicates() {
  try {
    cleanupWithLock_(function () {
      var tab = cleanupReadReportTab_('P1_DUP');
      if (!tab) throw new Error('ไม่พบแท็บ P1_DUP — รันเฟส 1 ก่อน');
      var h = tab.headers;
      var iConf = h.indexOf('CONFIRM(Y=รวม)');
      if (iConf < 0) iConf = h.indexOf('CONFIRM');
      var iKeep = h.indexOf('KEEP_MD_ID');
      var iDel = h.indexOf('DELETE_MD_ID');
      var iPts = h.indexOf('POINTS_SUM');
      var iFs = h.indexOf('FIRST_SEEN_MIN');
      var iLs = h.indexOf('LAST_SEEN_MAX');
      if (iKeep < 0 || iDel < 0) throw new Error('แท็บ P1_DUP ผิดรูปแบบ');

      var todo = [];
      for (var i = 0; i < tab.rows.length; i++) {
        if (String(tab.rows[i][iConf] || '').trim().toUpperCase() === 'Y') {
          todo.push(tab.rows[i]);
        }
      }
      if (todo.length === 0) {
        throw new Error('ยังไม่มีกลุ่มไหนตั้ง CONFIRM=Y ในแท็บ P1_DUP — ' +
          'พิมพ์ Y ในคอลัมน์ CONFIRM ของกลุ่มที่ตรวจแล้วและต้องการรวม');
      }
      if (!cleanupConfirm_('รวมแถวซ้ำ ' + todo.length + ' กลุ่ม',
        'จะคงแถว KEEP_MD_ID และลบแถว DELETE_MD_ID รวม ' + todo.length +
        ' กลุ่ม\n(POINTS/FIRST_SEEN/LAST_SEEN รวมให้แถวที่คงไว้)\nสำรองอัตโนมัติ 1 รอบก่อนลบ\n\nยืนยัน?')) {
        return 'ยกเลิก';
      }
      clBackupMasterTab_();

      var ctx = clLoadMaster_();
      var c = ctx.col;
      // ระบุตำแหน่งแถวจาก MD_ID ทั้งหมดก่อน (กันดัชนีเลื่อนหลังลบ)
      var byId = {};
      for (var r = 0; r < ctx.nRows; r++) {
        byId[clStr_(ctx.values[r][c.MD_ID])] = r;
      }
      var delRows = [], survivorOps = [];
      for (var g = 0; g < todo.length; g++) {
        var keep = String(todo[g][iKeep] || '').trim();
        var dels = String(todo[g][iDel] || '').trim().split(';').map(function (s) {
          return s.trim();
        }).filter(function (s) { return s; });
        if (!keep || byId[keep] === undefined) continue;
        var sRow = byId[keep];
        survivorOps.push({ row: sRow, pts: todo[g][iPts], fs: todo[g][iFs], ls: todo[g][iLs] });
        for (var d = 0; d < dels.length; d++) {
          if (byId[dels[d]] !== undefined) delRows.push(byId[dels[d]]);
        }
      }
      // อัปเดตแถวที่คงไว้ (เขียนเซลล์ตรง ๆ — จำนวนน้อย)
      for (var s = 0; s < survivorOps.length; s++) {
        var op = survivorOps[s];
        var r0 = op.row;
        var pts = parseFloat(op.pts);
        if (isFinite(pts)) ctx.sheet.getRange(r0 + 2, c.POINTS + 1).setValue(pts);
        if (String(op.fs || '') !== '') ctx.sheet.getRange(r0 + 2, c.FIRST_SEEN + 1).setValue(op.fs);
        if (String(op.ls || '') !== '') ctx.sheet.getRange(r0 + 2, c.LAST_SEEN + 1).setValue(op.ls);
      }
      // ลบแถว (จากล่างขึ้นบน กันเลื่อน)
      delRows.sort(function (a, b) { return b - a; });
      var deleted = 0;
      for (var k = 0; k < delRows.length; k++) {
        if (k > 0 && delRows[k] === delRows[k - 1]) continue; // กันซ้ำ
        ctx.sheet.deleteRows(delRows[k] + 2, 1);
        deleted++;
      }
      cleanupLog_('1c', 'MERGE', { groups: todo.length, deleted: deleted });
      cleanupToast_('รวมแถวซ้ำ ' + todo.length + ' กลุ่ม — ลบไป ' + deleted + ' แถว (สำรองไว้ในแท็บ BK แล้ว)');
      return 'ลบ ' + deleted + ' แถว';
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('รวมแถวซ้ำผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
