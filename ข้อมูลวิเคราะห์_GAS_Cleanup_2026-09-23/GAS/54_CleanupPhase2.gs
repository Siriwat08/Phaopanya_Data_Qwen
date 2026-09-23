/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 54_CleanupPhase2.gs — เฟส 2: kNN ตัดสิน O≠W + ชุดแก้คอลัมน์ราชการ (106 แถว)
 * พอร์ตจาก cleanup_2_md0003_corrections.py
 * ============================================================================
 * พื้นฐาน (Task 43): O≠W 383 แถว แยกตามพิกัดจริง (kNN 15 เพื่อนบ้าน):
 *   - 106 แถว "คอลัมน์ราชการผิด" (สไตล์ MD-0003, O ตรงพิกัด) → แก้ U/V/W/X + GEO_LAYER=KNN_FIX
 *   - 269 แถว "ที่อยู่พิมพ์ผิด" (W ตรงพิกัด) → ส่งแก้ฝั่งเอกสาร SCG (เฟส 4)
 *   -   8 แถว ไม่ชี้ขาด → ตรวจมือ
 *   (ตัวเลขคำนวณใหม่ทุกครั้งตามสถานะชีตปัจจุบัน)
 *
 * สูตรแก้กลุ่ม 106 (ข้อเท็จจริง: V/W/X เป็นไทยทั้งชีต 11,961/11,961 —
 *   EN อยู่เฉพาะ Y กับ suffix _EN ของ GEO_LAYER):
 *   V_new = N (จังหวัดไทยตรง ๆ / เผื่อ N ว่างใช้ V เดิม)
 *   W_new = O หลังตัดคำนำหน้า (เขต/อำเภอ/...)
 *   X_new = เสียงข้างมากของ Tambon_Kwaeng จากเพื่อนบ้านที่อำเภอตรงกับ O
 *   U_new = โหวตเพื่อนบ้าน → เผื่อด้วยพจนานุกรม SYS_TH_GEO (อำเภอ,ตำบล)
 *   GEO_LAYER_new = 'KNN_FIX' (รักษาร่องรอยแบบ MANUAL — กัน 3/3b เขียนทับ)
 *   Y คงเดิมทุกแถว (หลักฐานฝั่ง SOURCE — แก้ต้นทางเท่านั้น)
 *
 * ★ คุณสมบัติ "วนซ้ำลู่เข้า" (พบจากการทดสอบกับข้อมูลจริง 2026-09-23):
 *   หลักทำจริงรอบแรก 106 แถว pool ผู้โหวตสะอาดขึ้น (W เพื่อนบ้านถูกแก้แล้ว)
 *   → รันเฟส 2 ซ้ำอีก 1-2 รอบ จะตามเจอแถวที่เดิมถูกเพื่อนบ้านผิดฉุดไว้
 *   (ทดสอบจริง: +4 แถวรอบ 2 → +1 แถวรอบ 3 = รวม 111 แถว, ตัวเลขอาจต่างเล็กน้อย
 *   ตาม snapshot) — รัน "ตรวจอย่างเดียว" ซ้ำจนกลุ่ม fix = 0 แล้วค่อยจบเฟส
 *   ชุด Python (Task 44) อ่านไฟล์ static จึงเห็นแค่ 106 — ฉบับ GAS ดีกว่าจุดนี้
 * ============================================================================
 */

/**
 * เฟส 2 — kNN ตัดสิน + (ถ้า apply) เขียนแก้กลุ่ม 106
 * @param {boolean} apply false = dry-run / true = เขียน U/V/W/X/AA ของแถวที่ FLAGS ว่าง
 * @return {Object} สรุป
 */
function cleanupPhase2(apply) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var K = CLEANUP_CFG.K;
  var pool = clBuildVoterPool_(ctx);

  // พจนานุกรมไปรษณีย์ (อำเภอ_clean, ตำบล_clean) → รหัส — ใช้เมื่อโหวต U น้อย
  var postalPairTh = clLoadPostalPairTh_();

  // ---- 1) กลุ่ม O≠W + คำตัดสินรายแถว ----
  var owIdx = [];
  for (var i = 0; i < n; i++) {
    var O_ = clStr_(vals[i][c.O]), W_ = clStr_(vals[i][c.W]);
    if (O_ !== '' && W_ !== '' && O_ !== W_) owIdx.push(i);
  }
  var verdicts = { 'TH-side right (O matches pin)': 0,
    'EN-side right (W matches pin)': 0, 'undecided/border': 0 };
  var vInfo = {}; // dfIdx → {verdict, vo, vw, med}
  for (var j = 0; j < owIdx.length; j++) {
    var i = owIdx[j];
    var row = vals[i];
    var v = clKnnVerdict_(pool, row[c.LAT], row[c.LNG],
      clStr_(row[c.O]), clStr_(row[c.W]), K, i);
    verdicts[v.verdict]++;
    vInfo[i] = v;
  }

  // ---- 2) กลุ่มแก้คอลัมน์ราชการ (106) ----
  var fixRows = [], fixIdx = [];
  for (var j = 0; j < owIdx.length; j++) {
    var i = owIdx[j];
    var v = vInfo[i];
    if (v.verdict !== 'TH-side right (O matches pin)') continue;
    var row = vals[i];
    var oRaw = clStr_(row[c.O]);
    var oNorm = clNormAmp_(oRaw);
    var N_ = clStr_(row[c.N]), V_ = clStr_(row[c.V]);
    var vNew = N_ !== '' ? N_ : V_;
    var wNew = oNorm;

    // โหวต X/U จากเพื่อนบ้าน 15 ตัวที่อำเภอ (W ไทย) ตรงกับ O
    var nb = v.nb;
    var xVotes = [], uVotes = [];
    for (var q = 0; q < nb.pos.length; q++) {
      var p = nb.pos[q];
      var wv = pool.w[p];
      if (wv === oNorm || wv === oRaw) {
        if (pool.x[p]) xVotes.push(pool.x[p]);
        if (pool.u[p]) uVotes.push(pool.u[p]);
      }
    }
    var xm = clMajority_(xVotes);
    var um = clMajority_(uVotes);
    var xNew = xm.val, xVotesN = xm.count;
    var uNew = um.val, uVotesN = um.count;

    var flags = [];
    if (N_ === '') flags.push('V_KEEP_OLD_N_EMPTY');
    if (xVotesN < CLEANUP_CFG.MIN_VOTES) {
      xNew = clStr_(row[c.X]); xVotesN = 0;
      flags.push('X_KEEP_REVIEW');
    }
    if (uVotesN < CLEANUP_CFG.MIN_VOTES) {
      var fromDict = postalPairTh ? (postalPairTh[oNorm + '|' + xNew] || '') : '';
      if (fromDict) { uNew = fromDict; uVotesN = -1; }
      else { uNew = clStr_(row[c.U]); uVotesN = 0; flags.push('U_KEEP_REVIEW'); }
    }
    fixRows.push([i + 2, clStr_(row[c.MD_ID]),
      clStr_(row[c.LAT]), clStr_(row[c.LNG]),
      N_, oRaw,
      clStr_(row[c.U]), V_, clStr_(row[c.W]), clStr_(row[c.X]), clStr_(row[c.AA]),
      vNew, wNew, xNew, clPostalValue_(uNew), 'KNN_FIX',
      xVotesN, uVotesN, v.vo, v.med, flags.join(';')]);
    fixIdx.push({ i: i, flags: flags.join(';'),
      v: vNew, w: wNew, x: xNew, u: uNew });
  }
  cleanupReportTab_('P2_FIX', ['ROW', 'MD_ID', 'LAT', 'LNG', 'N_TH(now)', 'O_TH(now)',
    'U_OLD', 'V_OLD', 'W_OLD', 'X_OLD', 'GEO_LAYER_OLD',
    'V_NEW', 'W_NEW', 'X_NEW', 'U_NEW', 'GEO_LAYER_NEW',
    'X_VOTES', 'U_VOTES', 'KNN_VOTES_O', 'KNN_MED_M', 'FLAGS'], fixRows);

  // ---- 3) กลุ่มแก้ฝั่งเอกสาร (269) ----
  var docRows = [];
  for (var j = 0; j < owIdx.length; j++) {
    var i = owIdx[j];
    var v = vInfo[i];
    if (v.verdict !== 'EN-side right (W matches pin)') continue;
    var row = vals[i];
    docRows.push([i + 2, clStr_(row[c.MD_ID]), clStr_(row[c.NAME]), clStr_(row[c.ADDR]),
      clStr_(row[c.RAW_ADDRS]), clStr_(row[c.N]), clStr_(row[c.O]),
      clStr_(row[c.V]), clStr_(row[c.W]), clStr_(row[c.X]), clStr_(row[c.U]),
      clStr_(row[c.AA]), v.vw, v.med]);
  }
  cleanupReportTab_('P2_DOCSIDE', ['ROW', 'MD_ID', 'NAME_CLEAN', 'ADDR_CLEAN', 'RAW_ADDRS',
    'PROVINCE_TH(ผิด)', 'AMPHOE_TH(ผิด)', 'Changwat_ไทย(ถูก-พิกัด)',
    'Amphoe_Khet_ไทย(ถูก-พิกัด)', 'Tambon_Kwaeng', 'ไปรษณีย์', 'GEO_LAYER',
    'KNN_VOTES_W', 'KNN_MED_M'], docRows);

  // ---- 4) กลุ่มไม่ชี้ขาด (8) ----
  var undRows = [];
  for (var j = 0; j < owIdx.length; j++) {
    var i = owIdx[j];
    var v = vInfo[i];
    if (v.verdict !== 'undecided/border') continue;
    var row = vals[i];
    undRows.push([i + 2, clStr_(row[c.MD_ID]), clStr_(row[c.ADDR]),
      clStr_(row[c.N]), clStr_(row[c.O]), clStr_(row[c.V]), clStr_(row[c.W]),
      clStr_(row[c.X]), clStr_(row[c.U]), clStr_(row[c.AA]), v.vo, v.vw, v.med]);
  }
  cleanupReportTab_('P2_UNDECIDED', ['ROW', 'MD_ID', 'ADDR_CLEAN', 'N_TH(now)', 'O_TH(now)',
    'V(now)', 'W(now)', 'X(now)', 'U(now)', 'GEO_LAYER', 'VOTES_O', 'VOTES_W', 'KNN_MED_M'],
    undRows);

  // ---- 5) N≠V (จังหวัด) — ตัดสินแยกระดับ ----
  var nvRows = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var N_ = clStr_(row[c.N]), V_ = clStr_(row[c.V]);
    if (N_ === '' || V_ === '' || N_ === V_) continue;
    var nb = clKnnNeighbors_(pool, row[c.LAT], row[c.LNG], K, i);
    var vote = clVoteCount_(pool, nb.pos, 'v');
    var vn = vote.counts[N_] || 0, vv = vote.counts[V_] || 0;
    var pv;
    if (vn > vv && vn >= 3) pv = 'TH-side right (N matches pin)';
    else if (vv > vn && vv >= 3) pv = 'EN-side right (V matches pin)';
    else pv = 'undecided/border';
    var amphoeV = vInfo[i] ? vInfo[i].verdict : '';
    nvRows.push([i + 2, clStr_(row[c.MD_ID]), N_, V_,
      clStr_(row[c.O]), clStr_(row[c.W]), pv, amphoeV, clStr_(row[c.AA])]);
  }
  cleanupReportTab_('P2_NV40', ['ROW', 'MD_ID', 'N_TH(now)', 'V_ไทย(now)', 'O_TH(now)',
    'W(now)', 'PROV_VERDICT', 'AMPHOE_VERDICT', 'GEO_LAYER'], nvRows);

  // ---- ทำจริง: เขียน U/V/W/X/AA เฉพาะแถว FLAGS ว่าง ----
  var applied = 0, skipped = 0;
  if (apply) {
    var bad = clFindFormulas_(ctx, [c.U, c.V, c.W, c.X, c.AA]);
    if (bad.length) {
      cleanupLog_(2, 'ABORT_FORMULA', { cells: bad });
      throw new Error('พบสูตรในคอลัมน์ U/V/W/X/GEO_LAYER — ยกเลิก: ' + bad.join(', '));
    }
    // สร้างคอลัมน์ใหม่ทั้งเส้น (คงค่าเดิม) แล้วเปลี่ยนเฉพาะแถวที่แก่
    var colU = new Array(n), colV = new Array(n), colW = new Array(n),
        colX = new Array(n), colAA = new Array(n);
    for (var i = 0; i < n; i++) {
      colU[i] = vals[i][c.U]; colV[i] = clStr_(vals[i][c.V]);
      colW[i] = clStr_(vals[i][c.W]); colX[i] = clStr_(vals[i][c.X]);
      colAA[i] = clStr_(vals[i][c.AA]);
    }
    for (var f = 0; f < fixIdx.length; f++) {
      var op = fixIdx[f];
      if (op.flags !== '') { skipped++; continue; }
      colV[op.i] = op.v; colW[op.i] = op.w; colX[op.i] = op.x;
      colU[op.i] = clPostalValue_(op.u); colAA[op.i] = 'KNN_FIX';
      applied++;
    }
    clWriteColumn_(ctx, c.U, colU);
    clWriteColumn_(ctx, c.V, colV);
    clWriteColumn_(ctx, c.W, colW);
    clWriteColumn_(ctx, c.X, colX);
    clWriteColumn_(ctx, c.AA, colAA);
  }

  var summary = {
    apply: apply, owTotal: owIdx.length, verdicts: verdicts,
    govcolFix: fixRows.length, applied: applied, skippedFlagged: skipped,
    docside: docRows.length, undecided: undRows.length, nvRows: nvRows.length,
    seconds: Math.round((new Date() - t0) / 1000)
  };
  cleanupLog_(2, apply ? 'OK' : 'DRYRUN', summary);
  cleanupToast_('เฟส 2 ' + (apply ? '(ทำจริง ' + applied + ' แถว)' : '(dry-run)') +
    ': O≠W ' + owIdx.length + ' → แก้คอลัมน์ ' + fixRows.length +
    ' | ส่งแก้ SCG ' + docRows.length + ' | ไม่ชี้ขาด ' + undRows.length +
    ' | N≠V ' + nvRows.length + ' | ' + summary.seconds + ' วิ');
  return summary;
}

/** โหลดพจนานุกรม (อำเภอ_clean|ตำบล_clean) → รหัสไปรษณีย์ จากชีต SYS_TH_GEO */
function clLoadPostalPairTh_() {
  var sh = cleanupGetGeoSheet_();
  if (!sh) return null;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  var iAmp = hdr.indexOf('อำเภอ_clean');
  var iTam = hdr.indexOf('ตำบล_clean');
  var iPc = hdr.indexOf('รหัสไปรษณีย์');
  if (iAmp < 0 || iTam < 0 || iPc < 0) return null;
  var data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var d = {};
  for (var i = 0; i < data.length; i++) {
    var a = clStr_(data[i][iAmp]).trim();
    var t = clStr_(data[i][iTam]).trim();
    var pc = clStr_(data[i][iPc]).trim();
    if (a && t && pc && !(d[a + '|' + t])) d[a + '|' + t] = pc; // setdefault
  }
  return d;
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase2Dry() {
  try {
    cleanupWithLock_(function () { return cleanupPhase2(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 2 (dry-run) ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase2Apply() {
  try {
    cleanupWithLock_(function () {
      if (!cleanupConfirm_('เฟส 2 — ทำจริง',
        'เขียน U/V/W/X + GEO_LAYER=KNN_FIX ของแถว "คอลัมน์ราชการผิด" (สไตล์ MD-0003)\n' +
        'เฉพาะแถวที่ FLAGS ว่างเท่านั้น (แถวมีธงคงไว้ให้ตรวจก่อน)\n' +
        'Y และ UPDATED_AT ไม่ถูกแตะ · แนะนำสำรอง (เฟส 0) ก่อน\n\nยืนยัน?')) {
        return 'ยกเลิก';
      }
      return cleanupPhase2(true);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 2 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

/**
 * เมนู 2c — ค้นหาข้อความทุกชีต (เช่นรหัส SOURCE "ed08ffce" ของ MD-0003)
 * ใช้ตามรอยแถวต้นทางที่ต้องแก้ฝั่ง SOURCE ก่อน re-geocode
 */
function uiCleanupFindTextUi() {
  try {
    var ui = SpreadsheetApp.getUi();
    var resp = ui.prompt('ค้นหาข้อความทุกชีต',
      'ใส่ข้อความที่ต้องการตามรอย (เช่น ed08ffce หรือ MD-0003):', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    var needle = resp.getResponseText().trim();
    if (!needle) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var hits = [];
    for (var s = 0; s < sheets.length && hits.length < 500; s++) {
      var sh = sheets[s];
      if (sh.getLastRow() < 1) continue;
      var vals = sh.getDataRange().getValues();
      var lname = needle.toLowerCase();
      for (var r = 0; r < vals.length; r++) {
        for (var cidx = 0; cidx < vals[r].length; cidx++) {
          var cell = clStr_(vals[r][cidx]);
          if (cell !== '' && cell.toLowerCase().indexOf(lname) >= 0) {
            hits.push([sh.getName(), r + 1, cidx + 1, cell.substring(0, 120)]);
            if (hits.length >= 500) break;
          }
        }
        if (hits.length >= 500) break;
      }
    }
    cleanupReportTab_('P_SEARCH', ['ชีต', 'แถว', 'คอลัมน์', 'ข้อความ (ตัด 120 อักษร)'], hits);
    cleanupToast_('ค้นหา "' + needle + '": เจอ ' + hits.length + ' จุด → แท็บ P_SEARCH');
    cleanupLog_('2c', 'FIND', { needle: needle, hits: hits.length });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('ค้นหาผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
