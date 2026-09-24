/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45 · rev.2 (Task 47-48) · ไฟล์ใหม่
 * ไฟล์: 59_CleanupPhase1b.gs — เฟส 1b: ย้าย MATCH_KEY + ซ่อม SYS_MASTER_IDX
 * ============================================================================
 * ★ ทำไมต้องมีเฟสนี้ (รับข้อตรวจ Grok 1/2/3 + code review ของเราเอง):
 *
 *   ปุ่ม 2 (runDailyMatch) โหลดดัชนี SYS_MASTER_IDX ก่อน แล้วค้น MATCH_KEY
 *   ถ้าเราเปลี่ยน MATCH_KEY บน MASTER แต่ IDX ยังเก่า → แมตช์พัง
 *   → ปุ่ม 1 จะ upsert แถวใหม่แทน merge = เกิด duplicate จำนวนมาก
 *
 *   อีกทั้ง key ต้องคำนวณด้วย makeKey() ของ production จริง (00_CleanService.gs)
 *   ไม่ใช่การต่อข้อความ NAME|ADDR|OWNER ตรง ๆ เพราะ makeKey จะ:
 *     - ตัดคำนำหน้าเขตการปกครองที่ติด "ต้น" ที่อยู่อีกชั้น (cleanAddr)
 *     - ตัดรหัสไปรษณีย์ท้ายสตริง / ตัดคำนำหน้าชื่อคน / lowercase
 *   ฉบับแรก (Task 45) ใช้การต่อข้อความ → แถวที่ ADDR_CLEAN ขึ้นต้นด้วย
 *   "เขต/แขวง..." จะได้ key ต่างจากฝั่งปุ่ม 1 = รูที่ทำให้เกิด duplicate
 *   rev.2 แก้โดยเรียก makeKey ตัวจริง — key ที่เขียนกลับเทียบเท่าปุ่ม 1 เป๊ะ
 *
 * ★ กฎ atomic (บังคับในโค้ด): เฟส 1b ทำจริงได้ต่อเมื่อ
 *     1) วางแพตช์ cleanThai (GAS_patches/00_CleanService_prefix_phone_patch.gs) แล้ว
 *        — ไม่งั้น key ฝั่งข้อมูลใหม่ (makeKey) กับ MASTER จะเบี่ยงกัน
 *     2) ล้างเขตเขต/PII แล้ว (เฟส 1a) — ไม่งั้น key ที่คำนวณมาจากข้อควานสกปรก
 *     ทั้งสองเงื่อนไขตรวจอัตโนมัติ ทั้งโหมดตรวจและโหมดทำจริง
 *
 * ลำดับในเฟส 1b ทำจริง (ครบในกดเดียว):
 *   สำรอง MASTER → เขียน MATCH_KEY ใหม่ (makeKey) → ซ่อม SYS_MASTER_IDX
 *   (เรียกฟังก์ชัน production rebuildMasterIdxFromMaster — ไม่เขียนซ้ำเอง)
 *   → ลบแถว ghost ใน IDX (MD_ID ที่ไม่มีใน MASTER แล้ว เช่นที่ถูกรวมใน 1c)
 *   → ทดสอบการค้นทุกแถว (จำลอง lookup แบบปุ่ม 1) → แท็บ P1B_TEST
 * ============================================================================
 */

/**
 * เฟส 1b — ย้าย MATCH_KEY + ซ่อม SYS_MASTER_IDX + ทดสอบการค้น
 * @param {boolean} apply false = dry-run (รายงาน P1B_REVIEW + P1_DUP เท่านั้น)
 *                       true  = เขียน MATCH_KEY + ซ่อม IDX + ลบ ghost + ทดสอบ
 * @return {Object} สรุป
 */
function cleanupPhase1b(apply) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;

  // ---- ประตู 1: แพตช์ cleanThai ต้องวางแล้ว (ทั้ง dry และ apply) ----
  var patch = clCheckCleanThaiPatch_();
  if (!patch.ok) {
    cleanupLog_('1b', 'ABORT_NO_CLEAN_THAI_PATCH', { why: patch.why });
    throw new Error('หยุดก่อน: ยังไม่วางแพตช์ cleanThai — ' + patch.why +
      '\n\nเฟส 1b ย้าย MATCH_KEY ต้องออกแบบมาให้วางพร้อมแพตช์ "วันเดียวกัน"\n' +
      '(วาง GAS_patches/00_CleanService_prefix_phone_patch.gs แทนฟังก์ชัน cleanThai\n' +
      'เดิมใน 00_CleanService.gs กดบันทึก แล้วรันเฟส 1b ใหม่)\n' +
      'เหตุผล: ปุ่ม 1/2 คำนวณ key ฝั่งข้อมูลใหม่ด้วย cleanThai — ถ้ายังเป็นรุ่นเก่า\n' +
      'key สองฝั่งจะเบี่ยงกันและเกิดแถวซ้ำทันที');
  }

  // ---- ประตู 2: เฟส 1a ต้องล้างข้อความแล้ว (ไม่มีเขตเขต/เบอร์เหลือ) ----
  var dirty = 0;
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    if (clCleanAll_(clStr_(row[c.NAME])) !== clStr_(row[c.NAME]) ||
        clCleanAll_(clStr_(row[c.ADDR])) !== clStr_(row[c.ADDR]) ||
        clCleanAll_(clStr_(row[c.OWNER])) !== clStr_(row[c.OWNER])) { dirty++; }
  }
  if (dirty > 0) {
    cleanupLog_('1b', 'ABORT_TEXT_NOT_CLEAN', { dirty: dirty });
    throw new Error('หยุดก่อน: ยังมีข้อความที่รอล้าง ' + dirty + ' แถว (เขตเขต/เบอร์)\n' +
      'รัน "เฟส 1a ทำจริง" ก่อน แล้วค่อยรันเฟส 1b\n' +
      '(ถ้าเพิ่งมีข้อมูลใหม่ไหลเข้ามา — 1a รันซ้ำได้ ไม่ซ้ำซ้อน)');
  }

  // ---- ประตู 3: makeKey ของ production ต้องมีในโปรเจกต์ ----
  if (typeof makeKey !== 'function') {
    cleanupLog_('1b', 'ABORT_NO_MAKEKEY', {});
    throw new Error('หยุดก่อน: ไม่พบฟังก์ชัน makeKey ของระบบ (00_CleanService.gs)\n' +
      'เฟส 1b ต้องใช้ makeKey ตัวจริงของ production เพื่อให้ key ตรงกับปุ่ม 1/2 เป๊ะ\n' +
      'ตรวจว่าไฟล์ 00_CleanService.gs ยังอยู่ครบในโปรเจกต์ Apps Script');
  }

  // ---- คำนวณ key ใหม่ด้วย makeKey ของ production (ตัวจริง) ----
  var newKey = new Array(n);
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    newKey[i] = makeKey(clStr_(row[c.NAME]), clStr_(row[c.ADDR]), clStr_(row[c.OWNER]));
  }

  // ---- รายงานแถวที่ key เปลี่ยน ----
  var changedIdx = [];
  for (var i = 0; i < n; i++) {
    if (newKey[i] !== clStr_(vals[i][c.MATCH_KEY])) changedIdx.push(i);
  }
  var rev = [];
  for (var j = 0; j < changedIdx.length; j++) {
    var i = changedIdx[j];
    rev.push([i + 2, clStr_(vals[i][c.MD_ID]),
      clStr_(vals[i][c.MATCH_KEY]), newKey[i]]);
  }
  cleanupReportTab_('P1B_REVIEW', ['ROW', 'MD_ID', 'MATCH_KEY_OLD', 'MATCH_KEY_NEW'], rev);

  // ---- แผนรวมแถวซ้ำ (กลุ่มที่ key ใหม่ชนกัน ≥2 แถว) → P1_DUP ----
  var groups = {};
  for (var i = 0; i < n; i++) {
    var k = newKey[i];
    if (k) { if (!groups[k]) groups[k] = []; groups[k].push(i); }
  }
  var groupKeys = [];
  for (var gk in groups) groupKeys.push(gk);
  groupKeys.sort();
  var plan = [];
  var gi = 0;
  var oldExt = clOldAudit_(ctx, 'PHONE_EXTRACTED');
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
      var dn = oldExt[idxs[j]];
      if (dn) dnCodes.push(dn);
    }
    plan.push([gi, k2, mdids[0], mdids.slice(1).join(';'),
      mdids.join(';'), Math.round(ptsSum), fsMin || '', lsMax || '',
      clStr_(vals[idxs[0]][c.NAME]), clStr_(vals[idxs[0]][c.ADDR]),
      dnCodes.join('; '), '']);
  }
  cleanupReportTab_('P1_DUP', ['GROUP', 'NEW_MATCH_KEY', 'KEEP_MD_ID', 'DELETE_MD_ID',
    'ALL_MD_ID', 'POINTS_SUM', 'FIRST_SEEN_MIN', 'LAST_SEEN_MAX', 'NAME_NOW', 'ADDR_NOW',
    'DN_CODES_REMOVED', 'CONFIRM(Y=รวม)'], plan);

  // ---- ทำจริง ----
  var applied = 0, idxInfo = null, ghost = null, verify = null;
  if (apply) {
    // สำรอง MASTER ก่อนเขียน (แท็บ BK_MASTER_*)
    var bk = clBackupMasterTab_();
    // กันทับสูตร
    var bad = clFindFormulas_(ctx, [c.MATCH_KEY]);
    if (bad.length) {
      cleanupLog_('1b', 'ABORT_FORMULA', { cells: bad });
      throw new Error('พบสูตรในคอลัมน์ MATCH_KEY — ยกเลิก: ' + bad.join(', '));
    }
    clWriteColumn_(ctx, c.MATCH_KEY, newKey);
    applied = changedIdx.length;

    // ---- ซ่อม SYS_MASTER_IDX: เรียกฟังก์ชัน production ก่อน ----
    idxInfo = clRebuildMasterIdx_();

    // ---- ลบแถว ghost ใน IDX (MD_ID ไม่มีใน MASTER แล้ว) ----
    ghost = clIdxGhostCleanup_();

    // ---- ทดสอบการค้นทุกแถว (จำลอง lookup ของปุ่ม 1) ----
    verify = clVerifyIdxLookup_(newKey);
  }

  var summary = {
    apply: apply, rows: n, keyChanged: changedIdx.length,
    mergeGroups: plan.length, mergeRows: plan.length ?
      plan.reduce(function (s, p) { return s + String(p[4]).split(';').length; }, 0) : 0,
    appliedKeys: applied,
    idxRebuild: idxInfo, ghostsRemoved: ghost ? ghost.removed : null,
    verify: verify ? { checked: verify.checked, notFound: verify.notFound,
      sameKeyGroup: verify.sameKeyGroup } : null,
    backup: apply && bk ? bk.name : null,
    seconds: Math.round((new Date() - t0) / 1000)
  };
  cleanupLog_('1b', apply ? 'OK' : 'DRYRUN', summary);
  cleanupToast_('เฟส 1b ' + (apply ? '(ทำจริง)' : '(dry-run)') +
    ': key เปลี่ยน ' + changedIdx.length + ' แถว | กลุ่มซ้ำ ' + plan.length +
    (apply ? ' | ซ่อม IDX ' + (idxInfo ? idxInfo.total : '-') +
      ' | ลบ ghost ' + (ghost ? ghost.removed : '-') +
      ' | ทดสอบค้น ' + (verify ? verify.checked : '-') + ' แถว (ไม่เจอ ' +
      (verify ? verify.notFound : '-') + ')' : '') +
    ' | ' + summary.seconds + ' วิ');
  return summary;
}

/**
 * ซ่อม SYS_MASTER_IDX — เรียกฟังก์ชัน production (rebuildMasterIdxFromMaster)
 * ก่อน; ถ้าโปรเจกต์ไม่มีฟังก์ชันนั้น จะใช้ fallback ของชุดเราแทน
 * (upsert ตาม MD_ID + append ของที่ขาด — พฤติกรรมเดียวกับ production)
 */
function clRebuildMasterIdx_() {
  if (typeof rebuildMasterIdxFromMaster === 'function') {
    var r = rebuildMasterIdxFromMaster();
    return { via: 'production', total: r.total, updated: r.updated, appended: r.appended };
  }
  return clRebuildIdxFallback_();
}

/** Fallback: ซ่อม IDX แบบ upsert ตาม MD_ID (เทียบเท่า production แต่อ้างหัวคอลัมน์) */
function clRebuildIdxFallback_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLEANUP_CFG.IDX_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CLEANUP_CFG.IDX_SHEET);
    sh.getRange(1, 1, 1, 5).setValues([['MD_ID', 'MATCH_KEY', 'ALIAS_KEY', 'LAT', 'LNG']])
      .setFontWeight('bold');
  }
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var lastRow = sh.getLastRow();
  var byMdId = {};
  if (lastRow >= 2) {
    var data = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = 0; i < data.length; i++) {
      var id = clStr_(data[i][0]).trim();
      if (id) byMdId[id] = i + 2;
    }
  }
  var rows = [], updated = 0;
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var mdId = clStr_(row[c.MD_ID]).trim();
    var key = clStr_(row[c.MATCH_KEY]).trim();
    if (!mdId || !key) continue;
    var parts = key.split('|');
    var aliasKey = (parts.length === 3 && typeof makeKeyAlias === 'function')
      ? makeKeyAlias(parts[0], parts[1], parts[2]) : '';
    rows.push([mdId, key, aliasKey, row[c.LAT], row[c.LNG]]);
  }
  var toAppend = [];
  for (var r = 0; r < rows.length; r++) {
    var out = rows[r];
    if (byMdId[out[0]] !== undefined && byMdId[out[0]] > 0) {
      sh.getRange(byMdId[out[0]], 1, 1, 5).setValues([out]);
      updated++;
    } else {
      toAppend.push(out);
      byMdId[out[0]] = -1;
    }
  }
  if (toAppend.length) {
    sh.getRange(Math.max(sh.getLastRow() + 1, 2), 1, toAppend.length, 5)
      .setValues(toAppend);
  }
  return { via: 'fallback', total: rows.length, updated: updated, appended: toAppend.length };
}

/**
 * ลบแถว ghost ใน SYS_MASTER_IDX = แถวที่ MD_ID ไม่มีใน MASTER แล้ว
 * (เกิดจากการรวมแถวซ้ำ 1c หรือรีเซ็ตย้อนหลัง) — สำรอง IDX ก่อนลบเสมอ
 */
function clIdxGhostCleanup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLEANUP_CFG.IDX_SHEET);
  if (!sh || sh.getLastRow() < 2) return { removed: 0, backup: null };
  var bk = clBackupTabByName_(CLEANUP_CFG.IDX_SHEET, 'BK_IDX_');
  var ctx = clLoadMaster_();
  var c = ctx.col;
  var inMaster = {};
  for (var i = 0; i < ctx.nRows; i++) {
    inMaster[clStr_(ctx.values[i][c.MD_ID])] = true;
  }
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var delRows = [];
  for (var r = 0; r < data.length; r++) {
    var id = clStr_(data[r][0]).trim();
    if (id && !inMaster[id]) delRows.push(r + 2);
  }
  delRows.sort(function (a, b) { return b - a; });
  for (var d = 0; d < delRows.length; d++) {
    if (d > 0 && delRows[d] === delRows[d - 1]) continue;
    sh.deleteRows(delRows[d], 1);
  }
  return { removed: delRows.length, backup: bk ? bk.name : null };
}

/**
 * ทดสอบการค้นแบบปุ่ม 1: ทุกแถว MASTER คำนวณ key แล้วไปหาใน IDX
 * ต้องเจอ (ตัวเอง หรืออย่างน้อยแถวที่ key เดียวกัน = กลุ่มยังไม่รวม)
 * ถ้าไม่เจอเลย = ปุ่ม 1 จะสร้างแถวใหม่ = duplicate — ต้องกลับมาแก้
 */
function clVerifyIdxLookup_(newKey) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CLEANUP_CFG.IDX_SHEET);
  if (!sh || sh.getLastRow() < 2) {
    throw new Error('ไม่พบแท็บ ' + CLEANUP_CFG.IDX_SHEET + ' — ซ่อมดัชนีก่อนทดสอบ');
  }
  var ctx = clLoadMaster_();
  var c = ctx.col;
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var keyMap = {}; // key → { ids: [] }
  for (var r = 0; r < data.length; r++) {
    var k = clStr_(data[r][1]).trim();
    var id = clStr_(data[r][0]).trim();
    if (!k || !id) continue;
    if (!keyMap[k]) keyMap[k] = { ids: [] };
    keyMap[k].ids.push(id);
  }
  var checked = 0, notFound = 0, sameKeyGroup = 0;
  var bad = [];
  for (var i = 0; i < ctx.nRows; i++) {
    var mdId = clStr_(ctx.values[i][c.MD_ID]);
    var k = newKey[i];
    checked++;
    var hit = keyMap[k];
    if (!hit) {
      notFound++;
      if (bad.length < 100) bad.push([i + 2, mdId, k, 'NOT_FOUND — ปุ่ม 1 จะสร้างแถวใหม่']);
    } else if (hit.ids.indexOf(mdId) < 0) {
      sameKeyGroup++;
      if (bad.length < 100) bad.push([i + 2, mdId, k,
        'SAME_KEY_GROUP (' + hit.ids.join(';') + ') — รวมแถวใน 1c ได้']);
    }
  }
  cleanupReportTab_('P1B_TEST', ['ROW', 'MD_ID', 'KEY', 'ผลทดสอบ'], bad);
  return { checked: checked, notFound: notFound, sameKeyGroup: sameKeyGroup, badRows: bad };
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase1bDry() {
  try {
    cleanupWithLock_(function () { return cleanupPhase1b(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1b (dry-run) ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase1bApply() {
  try {
    cleanupWithLock_(function () {
      var msg = 'ทำจริงเฟส 1b: ย้าย MATCH_KEY + ซ่อม SYS_MASTER_IDX ทั้งชุด\n\n' +
        '★ ต้องวางแพตช์ cleanThai แล้ว (โค้ดตรวจให้ — หยุดอัตโนมัติถ้ายังไม่วาง)\n' +
        '★ ต้องรันเฟส 1a แล้ว (โค้ดตรวจให้ — ไม่มีเขตเขต/เบอร์เหลือ)\n\n' +
        'ขั้นตอนในกดเดียว: สำรอง MASTER → เขียน key ใหม่ (makeKey ของระบบ)\n' +
        '→ ซ่อม SYS_MASTER_IDX → ลบแถว ghost → ทดสอบการค้นทุกแถว (P1B_TEST)\n\n' +
        'หลังเสร็จ: กดปุ่ม 1 และปุ่ม 2 จริงอย่างละ 1 รอบ เพื่อยืนยันระบบรับ key ใหม่\n\n' +
        'ไม่แตะ UPDATED_AT · สำรองอัตโนมัติทั้ง MASTER และ IDX\n\nยืนยันทำจริง?';
      if (!cleanupConfirm_('เฟส 1b — ทำจริง (key + ดัชนี)', msg)) return 'ยกเลิก';
      return cleanupPhase1b(true);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 1b ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

/**
 * เมนู 1c — รวมแถวซ้ำตามแท็บ P1_DUP (เฉพาะกลุ่มที่ตั้ง CONFIRM = Y)
 * กติกา: คงแถว KEEP_MD_ID → POINTS=รวม, FIRST_SEEN=เก่าสุด, LAST_SEEN=ใหม่สุด
 *         → ลบแถว DELETE_MD_ID → ★ rev.2: ลบแถว ghost ใน SYS_MASTER_IDX ให้ด้วย
 */
function uiCleanupMergeDuplicates() {
  try {
    return cleanupWithLock_(function () {
      var tab = cleanupReadReportTab_('P1_DUP');
      if (!tab) throw new Error('ไม่พบแท็บ P1_DUP — รันเฟส 1b (ตรวจอย่างเดียว) ก่อน');
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
        ' กลุ่ม\n(POINTS/FIRST_SEEN/LAST_SEEN รวมให้แถวที่คงไว้)\n' +
        'สำรองอัตโนมัติ 1 รอบก่อนลบ\n' +
        '★ rev.2: ลบแถว ghost ใน SYS_MASTER_IDX ให้อัตโนมัติหลังรวม\n\nยืนยัน?')) {
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
      // ★ rev.2: ลบแถว ghost ใน IDX (MD_ID ที่ถูกลบไปแล้ว)
      var ghost = clIdxGhostCleanup_();
      cleanupLog_('1c', 'MERGE', { groups: todo.length, deleted: deleted,
        idxGhosts: ghost.removed, idxBackup: ghost.backup });
      cleanupToast_('รวมแถวซ้ำ ' + todo.length + ' กลุ่ม — ลบ ' + deleted +
        ' แถว + ลบ ghost IDX ' + ghost.removed + ' แถว (สำรองไว้แท็บ BK แล้ว)');
      return 'ลบ ' + deleted + ' แถว';
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('รวมแถวซ้ำผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
