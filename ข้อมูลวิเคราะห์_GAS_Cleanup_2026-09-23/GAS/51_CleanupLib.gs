/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 51_CleanupLib.gs — ไลบรารีกลาง (พอร์ต cleanup_lib.py ฝั่ง Python)
 * ============================================================================
 * เนื้อหา: regex กลาง + กฎการล้าง + โหลดข้อมูล + kNN geo-vote
 *          + สำรอง/กู้คืน + เขียนคอลัมน์แบบแบตช์ + ตรวจสูตรในคอลัมน์
 *
 * ★ regex ทุกตัวเทียบเท่าชุด Python (cleanup_lib.py) และแพตช์
 *   GAS_patches/00_CleanService_prefix_phone_patch.gs แล้ว (dual placement):
 *   DUP_PREFIX = (เขต|แขวง|ตำบล|อำเภอ|จังหวัด)\s*\1+
 *   PHONE      = 0\d{1,2}[sep]?\d{3,4}[sep]?\d{3,4}   (9-10 หลัก มี/ไม่มีขีด)
 *   LOOSE      = \d{7,} | \d([sep]\d){6,}             (เลขยาว/คั่นปะในชื่อ)
 *   (ฝั่ง GAS ใช้ capture group แทน lookbehind — รองรับทุก runtime)
 * ============================================================================
 */

var CL_R_EARTH = 6371.0;

/* ---------- regex กลาง (ใช้กับ .replace เท่านั้น — ปลอดภัยกับ /g) ---------- */
var CL_RE_DUP   = /(เขต|แขวง|ตำบล|อำเภอ|จังหวัด)\s*\1+/g;
var CL_RE_PHONE = /(^|[^\d])(0\d{1,2}[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4})(?!\d)/g;
var CL_RE_LOOSE = /(^|[^\d])(\d{7,}|\d(?:[\s\-\.\/]\d){6,})(?!\d)/g;
var CL_RE_THAI  = /[\u0e00-\u0e4e]/;
var CL_RE_AMP_PREFIX = /^(เขต|อำเภอ|กิ่งอำเภอ|อ\.|ตำบล|แขวง|ต\.)\s*/;

/** ลายแทน "ที่อยู่ตัดกลางคัน" — ตรงกับ TRUNC_PATS ฝั่ง Python */
var CL_TRUNC_PATS = [
  /แขวงบาง(?![\u0e00-\u0e4e])/,
  /เขตคลอง(?![\u0e00-\u0e4e])/,
  /ดอนเมือ(?!ง)/,
  /หนองร(?!ั)/
];

/** ชั้น GEO_LAYER ที่ถือว่า "คุณภาพสูง" (ตรวจใน preflight) */
var CL_HIGH_LAYERS = ['EXACT3', 'EXACT3_EN', 'CN_ZIP_OK', 'CN_ZIP_OK_EN',
  'POSTAL_RHSTB', 'POSTAL_RHSTB_EN', 'POSTAL_AMPHOE', 'POSTAL_AMPHOE_EN'];

/* ==========================================================================
 *  กฎการล้าง (2 กฎใหม่ — เทียบเท่า clean_all ของ Python)
 * ========================================================================== */

/** NFC normalize + trim (เทียบเท่า norm ของ Python) — คง Date ไว้ */
function clNorm_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var s = String(v);
  try { s = s.normalize('NFC'); } catch (e) { /* runtime เก่า */ }
  return s.trim();
}

/** แปลงค่าใด ๆ เป็นสตริงเพื่อเทียบ/แสดง (Date → yyyy-MM-dd) */
function clStr_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    try {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
      return v.toISOString().substring(0, 10);
    }
  }
  return String(v);
}

/** คีย์ที่เทียบลำดับได้ (ใช้กับ min/max ของ FIRST_SEEN/LAST_SEEN) */
function clSortable_(v) {
  return clStr_(v);
}

function clIsThai_(s) {
  return CL_RE_THAI.test(String(s || ''));
}

/** ตัดคำนำหน้าอำเภอ/เขต ก่อนเทียบ O กับค่าอำเภอ (เทียบเท่า norm_amp) */
function clNormAmp_(s) {
  return clStr_(s).replace(CL_RE_AMP_PREFIX, '').trim();
}

/** รวมคำนำหน้าเขตการปกครองที่ซ้ำ: เขตเขต/เขต เขต → เขต (idempotent) */
function clDedupPrefix_(s) {
  return String(s).replace(CL_RE_DUP, '$1');
}

/** ตัดเบอร์โทร (2 แบบ) ออก — เว้นวรรคแทน ลบเศษคั่นท้าย รวมช่องว่าง
 *  (เทียบเท่า strip_phone ของ Python เป๊ะ) */
function clStripPhone_(s) {
  var s0 = String(s);
  var s2 = s0.replace(CL_RE_PHONE, '$1 ');
  s2 = s2.replace(CL_RE_LOOSE, '$1 ');
  if (s2 !== s0 && /[\s\/\-]+$/.test(s2)) {
    s2 = s2.replace(/[\s\/\-]+$/, '');
  }
  s2 = s2.replace(/\s+/g, ' ');
  return s2.replace(/^[\s,;|]+|[\s,;|]+$/g, '');
}

/** เก็บหลักฐานเบอร์ที่ถูกตัด (เทียบเท่า extract_phones)
 *  LOOSE ตรวจบนสตริงหลังตัด PHONE แล้ว — กันหลักฐานซ้ำ */
function clExtractPhones_(s) {
  var str = String(s || '');
  var out = [];
  var m;
  var re1 = new RegExp(CL_RE_PHONE.source, 'g');
  while ((m = re1.exec(str)) !== null) {
    if (m[2]) out.push(m[2]);
  }
  var rest = str.replace(CL_RE_PHONE, '$1 ');
  var re2 = new RegExp(CL_RE_LOOSE.source, 'g');
  while ((m = re2.exec(rest)) !== null) {
    if (m[2]) out.push(m[2]);
  }
  return out;
}

/** รวม 2 กฎใหม่ — ใช้กับ NAME/ADDR/OWNER ที่ผ่าน cleanThai เดิมแล้ว */
function clCleanAll_(s) {
  return clStripPhone_(clDedupPrefix_(clStr_(s)));
}

/** ตรวจว่ามีเบอร์แบบ strict ในสตริง (ใช้ใน preflight/สรุป PII) */
function clHasPhone_(s) {
  return new RegExp(CL_RE_PHONE.source).test(String(s || ''));
}

/** ตรวจว่ามีเลขยาว/คั่นแบบหลวมในสตริง */
function clHasLoose_(s) {
  return new RegExp(CL_RE_LOOSE.source).test(String(s || ''));
}

/** ตรวจว่าเป็นที่อยู่ตัดกลางคันตามลายแทน */
function clIsTruncated_(addr) {
  var a = String(addr || '');
  for (var i = 0; i < CL_TRUNC_PATS.length; i++) {
    if (CL_TRUNC_PATS[i].test(a)) return true;
  }
  return false;
}

/** นับจำนวน "แถวเกิน" จาก MATCH_KEY ซ้ำ (เทียบเท่า dup_key_counts) */
function clDupKeyCount_(keys) {
  var c = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k) c[k] = (c[k] || 0) + 1;
  }
  var extra = 0;
  for (var k2 in c) { if (c[k2] > 1) extra += c[k2] - 1; }
  return extra;
}

/** หาค่าเสียงข้างมาก — คืน {val, count} (เทียบเท่า majority ของ Python) */
function clMajority_(values) {
  if (!values || values.length === 0) return { val: '', count: 0 };
  var c = {}, order = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (v === '' || v === undefined || v === null) continue;
    if (!(v in c)) order.push(v);
    c[v] = (c[v] || 0) + 1;
  }
  var best = '', bestN = 0;
  for (var j = 0; j < order.length; j++) {
    if (c[order[j]] > bestN) { best = order[j]; bestN = c[order[j]]; }
  }
  return { val: best, count: bestN };
}

/* ==========================================================================
 *  โหลดข้อมูล MASTER (ครั้งเดียวต่อเฟส)
 * ========================================================================== */

/**
 * อ่านชีต MASTER ทั้งหมด → คืน context:
 *   { sheet, headers[], col{semantic→idx 0-based}, values[][], nRows }
 * normalize ทุกเซลล์แบบเดียวกับ load_master ของ Python (NFC + trim)
 */
function clLoadMaster_() {
  var sheet = cleanupGetMasterSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) throw new Error('ชีต MASTER ไม่มีข้อมูล (แถว < 2)');
  var raw = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = raw[0].map(function (h) { return String(h || '').trim(); });
  var col = {};
  var missing = [];
  for (var key in CLEANUP_COLS) {
    var name = CLEANUP_COLS[key];
    var i = headers.indexOf(name);
    if (i < 0) { missing.push(key + ' (' + name + ')'); }
    col[key] = i;
  }
  if (missing.length) {
    throw new Error('คอลัมน์หายจากชีต MASTER: ' + missing.join(', ') +
      ' — ตรวจว่าแท็บที่กำหนดใน CLEANUP_CFG.MASTER_SHEET ใช่ชีต MASTER_PLACE จริง');
  }
  var values = [];
  for (var r = 1; r < raw.length; r++) {
    var row = raw[r];
    var line = new Array(row.length);
    for (var c = 0; c < row.length; c++) {
      var v = row[c];
      line[c] = (Object.prototype.toString.call(v) === '[object Date]') ? v : clNorm_(v);
    }
    values.push(line);
  }
  return { sheet: sheet, headers: headers, col: col, values: values,
    nRows: values.length, lastRow: lastRow, lastCol: lastCol };
}

/** ตำแหน่งคอลัมน์ใหม่ (PHONE_EXTRACTED / CLEANUP_DATE) — เติมหัวให้ถ้ายังไม่มี
 *  คืน { PHONE_EXTRACTED: idx, CLEANUP_DATE: idx } (0-based) */
function clEnsureAuditColumns_(ctx) {
  var sheet = ctx.sheet;
  var headers = ctx.headers;
  var out = {};
  var lastCol = sheet.getLastColumn();
  ['PHONE_EXTRACTED', 'CLEANUP_DATE'].forEach(function (name) {
    var i = headers.indexOf(name);
    if (i < 0) {
      // เพิ่มหัวคอลัมน์ใหม่ต่อท้าย (เฉพาะโหมดทำจริง — dry-run ใช้ค่าว่างแทน)
      i = lastCol;
      sheet.getRange(1, i + 1).setValue(name);
      headers.push(name);
      lastCol += 1;
    }
    out[name] = i;
  });
  ctx.headers = headers;
  ctx.lastCol = lastCol;
  return out;
}

/** อ่านค่าคอลัมน์ audit เดิม (ถ้าไม่มีคอลัมน์ → คืนอาร์เรย์ว่าง) */
function clOldAudit_(ctx, name) {
  var i = ctx.headers.indexOf(name);
  if (i < 0) {
    var arr = [];
    for (var r = 0; r < ctx.nRows; r++) arr.push('');
    return arr;
  }
  return ctx.values.map(function (row) { return clStr_(row[i]); });
}

/** เขียนทั้งคอลัมน์ (แบบแบตช์ 1 ครั้ง — เร็วกว่าเขียนเซลล์ต่อเซลล์ ~1,000 เท่า)
 *  values: อาร์เรย์ 1 มิติความยาว = จำนวนแถวข้อมูล */
function clWriteColumn_(ctx, colIdx0, values) {
  if (colIdx0 < 0) throw new Error('clWriteColumn_: คอลัมน์ไม่ถูกต้อง');
  if (values.length !== ctx.nRows) {
    throw new Error('clWriteColumn_: ความยาวไม่ตรง (' + values.length + ' vs ' + ctx.nRows + ')');
  }
  var twoD = values.map(function (v) { return [v]; });
  ctx.sheet.getRange(2, colIdx0 + 1, ctx.nRows, 1).setValues(twoD);
}

/** ตรวจว่าคอลัมน์เป้าหมายไม่มีสูตร (กันทับสูตร) — คืนรายการตำแหน่งที่มีสูตร */
function clFindFormulas_(ctx, colIdxs) {
  var bad = [];
  var range = ctx.sheet.getRange(2, 1, ctx.nRows, ctx.lastCol);
  var formulas = range.getFormulas();
  for (var i = 0; i < colIdxs.length; i++) {
    var c = colIdxs[i];
    if (c < 0) continue;
    for (var r = 0; r < formulas.length; r++) {
      var f = formulas[r][c];
      if (f && String(f).charAt(0) === '=') {
        bad.push('แถว ' + (r + 2) + ' คอลัมน์ ' + ctx.headers[c]);
        if (bad.length >= 5) return bad;
      }
    }
  }
  return bad;
}

/** ไปรษณีย์แบบตัวเลข (คงชนิด Number เหมือนคอลัมน์ U ปัจจุบัน) */
function clPostalValue_(v) {
  var s = clStr_(v).trim();
  return /^\d+$/.test(s) ? Number(s) : s;
}

/* ==========================================================================
 *  kNN geo-vote (พอร์ตจาก build_voter_pool / knn_neighbors / knn_verdict)
 * ========================================================================== */

/** เตรียม pool ผู้โหวต = แถวที่ LAT/LNG ใช้ได้และมี W (พิกัดเป็นเรเดียน) */
function clBuildVoterPool_(ctx) {
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var la = [], lo = [], w = [], v = [], x = [], u = [], idx = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var lat = parseFloat(row[c.LAT]);
    var lng = parseFloat(row[c.LNG]);
    var wv = clStr_(row[c.W]);
    if (isFinite(lat) && isFinite(lng) && wv !== '') {
      la.push(lat * Math.PI / 180);
      lo.push(lng * Math.PI / 180);
      w.push(wv);
      v.push(clStr_(row[c.V]));
      x.push(clStr_(row[c.X]));
      u.push(clStr_(row[c.U]));
      idx.push(i); // ดัชนีแถวใน ctx.values
    }
  }
  return { la: la, lo: lo, w: w, v: v, x: x, u: u, idx: idx, count: la.length };
}

/**
 * k เพื่อนบ้านใกล้สุด (ตัดตัวเองออก) — คืน { d: [ระยะกม.], pos: [ตำแหน่งใน pool] }
 * เรียงจากใกล้ → ไกล (เทียบเท่า argsort ของ Python)
 */
function clKnnNeighbors_(pool, latDeg, lngDeg, k, excludeDfIdx) {
  var laT = parseFloat(latDeg) * Math.PI / 180;
  var loT = parseFloat(lngDeg) * Math.PI / 180;
  var cosT = Math.cos(laT);
  var n = pool.count;
  var kd = [], kp = [];
  for (var j = 0; j < n; j++) {
    if (excludeDfIdx !== null && excludeDfIdx !== undefined && pool.idx[j] === excludeDfIdx) continue;
    var dLat = laT - pool.la[j];
    var dLon = loT - pool.lo[j];
    var a = Math.sin(dLat / 2); a = a * a;
    var b = Math.sin(dLon / 2); b = b * b;
    var h = a + cosT * Math.cos(pool.la[j]) * b;
    if (h < 0) h = 0; else if (h > 1) h = 1;
    var d = 2 * CL_R_EARTH * Math.asin(Math.sqrt(h));
    if (kd.length < k) {
      var p = kd.length;
      while (p > 0 && kd[p - 1] > d) { kd[p] = kd[p - 1]; kp[p] = kp[p - 1]; p--; }
      kd[p] = d; kp[p] = j;
    } else if (d < kd[k - 1]) {
      var p2 = k - 1;
      while (p2 > 0 && kd[p2 - 1] > d) { kd[p2] = kd[p2 - 1]; kp[p2] = kp[p2 - 1]; p2--; }
      kd[p2] = d; kp[p2] = j;
    }
  }
  return { d: kd, pos: kp };
}

/** ค่ามัธยฐานระยะของเพื่อนบ้าน (k=15 → สมาชิกลำดับ 8) */
function clMedian_(sortedD) {
  if (!sortedD || sortedD.length === 0) return 0;
  return sortedD[Math.floor(sortedD.length / 2)];
}

/** โหวตค่า W ของเพื่อนบ้าน → {counts, order} */
function clVoteCount_(pool, pos, key) {
  var c = {}, order = [];
  for (var i = 0; i < pos.length; i++) {
    var val = pool[key][pos[i]];
    if (val === '') continue;
    if (!(val in c)) order.push(val);
    c[val] = (c[val] || 0) + 1;
  }
  return { counts: c, order: order };
}

/**
 * ตัดสินว่า O(ฝั่งไทย) หรือ W(ฝั่ง EN) ตรงกับพิกัดจริง (เทียบเท่า knn_verdict)
 * คืน { verdict, vo, vw, med }
 */
function clKnnVerdict_(pool, latDeg, lngDeg, o, w, k, excludeDfIdx) {
  var nb = clKnnNeighbors_(pool, latDeg, lngDeg, k, excludeDfIdx);
  var vote = clVoteCount_(pool, nb.pos, 'w');
  var vo = vote.counts[o] || 0;
  var vw = vote.counts[w] || 0;
  var med = clMedian_(nb.d);
  var verdict;
  if (vo > vw && vo >= 3) verdict = 'TH-side right (O matches pin)';
  else if (vw > vo && vw >= 3) verdict = 'EN-side right (W matches pin)';
  else verdict = 'undecided/border';
  return { verdict: verdict, vo: vo, vw: vw, med: Math.round(med * 10) / 10, nb: nb };
}

/* ==========================================================================
 *  สำรอง / กู้คืน
 * ========================================================================== */

/** สำรองค่า MASTER ทั้งชีต → แท็บใหม่ "BK_MASTER_<วันที่>_<เวลา>" (ค่าเท่านั้น) */
function clBackupMasterTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = cleanupGetMasterSheet_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    'yyyyMMdd_HHmmss');
  var name = 'BK_MASTER_' + stamp;
  var existing = ss.getSheetByName(name);
  if (existing) ss.deleteSheet(existing);
  var bk = ss.insertSheet(name);
  var lastRow = src.getLastRow(), lastCol = src.getLastColumn();
  var values = src.getRange(1, 1, lastRow, lastCol).getValues();
  bk.getRange(1, 1, lastRow, lastCol).setValues(values);
  return { name: name, rows: lastRow, cols: lastCol };
}

/** สำรองทั้งไฟล์สเปรดชีตไป Google Drive (ครบทุกชีต ทุกสูตร) */
function clBackupWholeFile_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    'yyyyMMdd_HHmm');
  var file = DriveApp.getFileById(ss.getId());
  var copy = file.makeCopy('BACKUP_MasterPlace_' + stamp);
  return copy.getUrl();
}

/** รายชื่อแท็บสำรอง (ใหม่สุดก่อน) */
function clListBackupTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var out = [];
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName();
    if (n.indexOf('BK_MASTER_') === 0) out.push(n);
  }
  out.sort();
  out.reverse();
  return out;
}

/** กู้คืน MASTER จากแท็บสำรอง (เขียนค่ากลับตามตำแหน่งเดิม) */
function clRestoreMasterFromTab_(bkName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bk = ss.getSheetByName(bkName);
  if (!bk) throw new Error('ไม่พบแท็บสำรอง: ' + bkName);
  var dst = cleanupGetMasterSheet_();
  var bkVals = bk.getDataRange().getValues();
  // กู้คืนเฉพาะช่วงที่แท็บสำรองมี — คอลัมน์ที่เพิ่มหลังสำรองคงค่าปัจจุบันไว้
  dst.getRange(1, 1, bkVals.length, bkVals[0].length).setValues(bkVals);
  return { rows: bkVals.length, cols: bkVals[0].length };
}

/* ==========================================================================
 *  CSV / ไฟล์ออก (เฟส 5)
 * ========================================================================== */

/** แปลงค่าเป็นช่อง CSV ที่ escape แล้ว */
function clCsvCell_(v) {
  var s = clStr_(v);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** สร้าง CSV ทั้งไฟล์จาก headers + rows (ใส่ BOM ให้ Excel เปิดไทยถูก) */
function clBuildCsv_(headers, rows) {
  var lines = [headers.map(clCsvCell_).join(',')];
  for (var i = 0; i < rows.length; i++) {
    lines.push(rows[i].map(clCsvCell_).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** เขียนไฟล์ CSV/zip ลง Drive แล้วคืน URL (แชร์อ่านได้ผ่านลิงก์) */
function clSaveToDrive_(content, filename, mimeType) {
  var blob = Utilities.newBlob(content, mimeType, filename);
  var zipName = filename.replace(/\.csv$/i, '') + '.zip';
  var file;
  try {
    var zip = Utilities.zip([blob], zipName);
    file = DriveApp.createFile(zip);
  } catch (e) {
    file = DriveApp.createFile(blob); // แชร์ไม่ได้ก็ยังสร้างไฟล์เปล่า ๆ
  }
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e2) { /* บัญชีบางแบบห้ามแชร์สาธารณะ */ }
  return { url: file.getUrl(), name: file.getName() };
}
