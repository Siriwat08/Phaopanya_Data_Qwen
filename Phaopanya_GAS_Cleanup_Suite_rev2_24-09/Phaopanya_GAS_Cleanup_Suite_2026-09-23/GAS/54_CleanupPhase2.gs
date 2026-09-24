/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45 · rev.2 (Task 47-48)
 * ไฟล์: 54_CleanupPhase2.gs — เฟส 2: kNN ตัดสิน O≠W + ชุดแก้คอลัมน์ราชการ
 * พอร์ตจาก cleanup_2_md0003_corrections.py
 * ============================================================================
 * พื้นฐาน (Task 43): O≠W 383 แถว แยกตามพิกัดจริง (kNN 15 เพื่อนบ้าน):
 *   - 106 แถว "คอลัมน์ราชการผิด" (สไตล์ MD-0003, O ตรงพิกัด) → แก้ U/V/W/X + GEO_LAYER=KNN_FIX
 *   - 269 แถว "ที่อยู่พิมพ์ผิด" (W ตรงพิกัด) → ส่งแก้ฝั่งเอกสาร SCG (เฟส 4)
 *   -   8 แถว ไม่ชี้ขาด → ตรวจมือ
 *   (ตัวเลขคำนวณใหม่ทุกครั้งตามสถานะชีตปัจจุบัน)
 *
 * ★ rev.2 — รับข้อตรวจ Grok 3 ฉบับ (กัน "auto ทั้งก้อน"):
 *   แถวจะถูกเขียนอัตโนมัติ "ต่อเมื่อผ่านธงทั้งหมด" — ติดธง = คิวตรวจมือ:
 *   1) KNN_THIN   : เสียงโหวต O ต่ำกว่า MIN_KNN_DOMINANCE (10/15)
 *                   — โหวตบาง เชื่อไม่พอ ให้คนดู (เปิด MAPS_URL เทียบ)
 *   2) KNN_FAR    : มัธยฐานระยะเพื่อนบ้านเกิน MAX_MED_M (3 กม.)
 *                   — พินโดดเดี่ยว เพื่อนบ้านอาจไม่ใช่พื้นที่เดียวกัน
 *   3) NV_CONFLICT: แถวนั้น N≠V (จังหวัดขัด) และโหวตจังหวัด "ไม่ได้ชี้ขาดข้าง N"
 *                   — เขียน V=N ไปพร้อมกันจะเสี่ยงแก้ผิดสองชั้น ให้ตรวจมือ
 *      (ธงเดิม X_KEEP_REVIEW / U_KEEP_REVIEW / V_KEEP_OLD_N_EMPTY ยังอยู่ครบ)
 *
 * ★ rev.2 — โหมดนำร่อง (pilot): เมนู "นำร่อง N แถว" เขียนเฉพาะ N แถวแรกที่ผ่านธง
 *   (แถวแรกคือ MD-0003) ให้ผู้ใช้เปิด MAPS_URL เทียบ Google Maps ก่อน
 *   แล้วค่อยกด "ทำจริง" เต็มชุด — ตาม SOP ที่ AI ทั้ง 4 ฝ่ายเห็นตรงกัน
 *
 * ★ rev.2 — คอลัมน์ MAPS_URL (=HYPERLINK) ในทุกแท็บรายงานของเฟสนี้
 *
 * สูตรแก้กลุ่ม 106 (ข้อเท็จจริง: V/W/X เป็นไทยทั้งชีต 11,961/11,961 —
 *   EN อยู่เฉพาะ Y กับ suffix _EN ของ GEO_LAYER):
 *   V_new = N (จังหวัดไทยตรง ๆ / เผื่อด้วย V เดิมเมื่อ N ว่าง)
 *   W_new = O หลังตัดคำนำหน้า (เขต/อำเภอ/...)
 *   X_new = เสียงข้างมากของ Tambon_Kwaeng จากเพื่อนบ้านที่อำเภอตรงกับ O
 *   U_new = โหวตเพื่อนบ้าน → เผื่อด้วยพจนานุกรม SYS_TH_GEO (อำเภอ,ตำบล)
 *   GEO_LAYER_new = 'KNN_FIX' (รักษาร่องรอยแบบ MANUAL — กัน 3/3b เขียนทับ)
 *   Y คงเดิมทุกแถว (หลักฐานฝั่ง SOURCE — แก้ต้นทางเท่านั้น)
 *
 * ★ คุณสมบัติ "วนซ้ำลู่เข้า" (พบจากการทดสอบกับข้อมูลจริง 2026-09-23):
 *   หลังทำจริงรอบแรก pool ผู้โหวตสะอาดขึ้น (W เพื่อนบ้านถูกแก้แล้ว)
 *   → รัน "ตรวจอย่างเดียว" ซ้ำ อาจตามเจอแถวที่เดิมถูกเพื่อนบ้านผิดฉุดไว้
 *   (ทดสอบจริง: +4 แถวรอบ 2 → +1 แถวรอบ 3 = รวม 111 แถว)
 *   ★ rev.2 รอบลู่เข้า: แถวที่เคยติดธง KNN_THIN อาจคลายเป็นผ่านธงในรอบหลัง
 *   จบเฟสเมื่อ "แถวที่ผ่านธง = 0" — ที่เหลือติดธงค้าง = คิวตรวจมือถาวร
 * ============================================================================
 */

/**
 * เฟส 2 — kNN ตัดสิน + (ถ้า apply) เขียนแก้กลุ่มที่ผ่านธง
 * @param {boolean} apply false = dry-run / true = เขียน U/V/W/X/AA ของแถวที่ผ่านธง
 * @param {number=} pilotCount 0/ไม่ส่ง = ทำจริงทั้งชุด | >0 = นำร่องเฉพาะ N แถวแรกที่ผ่านธง
 * @return {Object} สรุป
 */
function cleanupPhase2(apply, pilotCount) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var K = CLEANUP_CFG.K;
  var pool = clBuildVoterPool_(ctx);

  // พจนานุกรมไปรษณีย์ (อำเภอ_clean, ตำบล_clean) → รหัส — ใช้เมื่อโหวต U น้อย
  var postalPairTh = clLoadPostalPairTh_();

  // ---- 0) ตัดสินจังหวัด (N≠V) ก่อน — ใช้เป็นธงกันเขียน V=N ผิดสองชั้น ----
  var nvVerdict = {}; // dfIdx → 'TH-side right (N matches pin)' ฯลฯ
  for (var i = 0; i < n; i++) {
    var N_ = clStr_(vals[i][c.N]), V_ = clStr_(vals[i][c.V]);
    if (N_ === '' || V_ === '' || N_ === V_) continue;
    var nbv = clKnnNeighbors_(pool, vals[i][c.LAT], vals[i][c.LNG], K, i);
    var voteV = clVoteCount_(pool, nbv.pos, 'v');
    var vn = voteV.counts[N_] || 0, vv = voteV.counts[V_] || 0;
    if (vn > vv && vn >= 3) nvVerdict[i] = 'TH-side right (N matches pin)';
    else if (vv > vn && vv >= 3) nvVerdict[i] = 'EN-side right (V matches pin)';
    else nvVerdict[i] = 'undecided/border';
  }

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

  // ---- 2) กลุ่มแก้คอลัมน์ราชการ (106) + ธง rev.2 ----
  var fixRows = [], fixIdx = [];
  var flagCount = { KNN_THIN: 0, KNN_FAR: 0, NV_CONFLICT: 0,
    X_KEEP_REVIEW: 0, U_KEEP_REVIEW: 0, V_KEEP_OLD_N_EMPTY: 0 };
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
    if (N_ === '') { flags.push('V_KEEP_OLD_N_EMPTY'); flagCount.V_KEEP_OLD_N_EMPTY++; }
    if (xVotesN < CLEANUP_CFG.MIN_VOTES) {
      xNew = clStr_(row[c.X]); xVotesN = 0;
      flags.push('X_KEEP_REVIEW'); flagCount.X_KEEP_REVIEW++;
    }
    if (uVotesN < CLEANUP_CFG.MIN_VOTES) {
      var fromDict = postalPairTh ? (postalPairTh[oNorm + '|' + xNew] || '') : '';
      if (fromDict) { uNew = fromDict; uVotesN = -1; }
      else { uNew = clStr_(row[c.U]); uVotesN = 0; flags.push('U_KEEP_REVIEW'); flagCount.U_KEEP_REVIEW++; }
    }
    // ★ ธง rev.2 — ทั้ง 3 ชนิด (เกณฑ์ปรับได้ที่ CLEANUP_CFG)
    if (v.vo < CLEANUP_CFG.MIN_KNN_DOMINANCE) {
      flags.push('KNN_THIN(' + v.vo + '/' + K + ')'); flagCount.KNN_THIN++;
    }
    if (v.med > CLEANUP_CFG.MAX_MED_M) {
      flags.push('KNN_FAR(' + v.med + 'm)'); flagCount.KNN_FAR++;
    }
    if (N_ !== '' && V_ !== '' && N_ !== V_ &&
        nvVerdict[i] !== 'TH-side right (N matches pin)') {
      flags.push('NV_CONFLICT(' + nvVerdict[i] + ')'); flagCount.NV_CONFLICT++;
    }

    fixRows.push([i + 2, clStr_(row[c.MD_ID]),
      clStr_(row[c.LAT]), clStr_(row[c.LNG]),
      clMapsUrl_(row[c.LAT], row[c.LNG]),
      N_, oRaw,
      clStr_(row[c.U]), V_, clStr_(row[c.W]), clStr_(row[c.X]), clStr_(row[c.AA]),
      vNew, wNew, xNew, clPostalValue_(uNew), 'KNN_FIX',
      xVotesN, uVotesN, v.vo, v.med, flags.join(';')]);
    fixIdx.push({ i: i, flags: flags.join(';'),
      v: vNew, w: wNew, x: xNew, u: uNew });
  }
  cleanupReportTab_('P2_FIX', ['ROW', 'MD_ID', 'LAT', 'LNG', 'MAPS_URL',
    'N_TH(now)', 'O_TH(now)',
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
      clStr_(row[c.AA]), v.vw, v.med,
      clStr_(row[c.LAT]), clStr_(row[c.LNG]), clMapsUrl_(row[c.LAT], row[c.LNG])]);
  }
  cleanupReportTab_('P2_DOCSIDE', ['ROW', 'MD_ID', 'NAME_CLEAN', 'ADDR_CLEAN', 'RAW_ADDRS',
    'PROVINCE_TH(ผิด)', 'AMPHOE_TH(ผิด)', 'Changwat_ไทย(ถูก-พิกัด)',
    'Amphoe_Khet_ไทย(ถูก-พิกัด)', 'Tambon_Kwaeng', 'ไปรษณีย์', 'GEO_LAYER',
    'KNN_VOTES_W', 'KNN_MED_M', 'LAT', 'LNG', 'MAPS_URL'], docRows);

  // ---- 4) กลุ่มไม่ชี้ขาด (8) ----
  var undRows = [];
  for (var j = 0; j < owIdx.length; j++) {
    var i = owIdx[j];
    var v = vInfo[i];
    if (v.verdict !== 'undecided/border') continue;
    var row = vals[i];
    undRows.push([i + 2, clStr_(row[c.MD_ID]), clStr_(row[c.ADDR]),
      clStr_(row[c.N]), clStr_(row[c.O]), clStr_(row[c.V]), clStr_(row[c.W]),
      clStr_(row[c.X]), clStr_(row[c.U]), clStr_(row[c.AA]), v.vo, v.vw, v.med,
      clMapsUrl_(row[c.LAT], row[c.LNG])]);
  }
  cleanupReportTab_('P2_UNDECIDED', ['ROW', 'MD_ID', 'ADDR_CLEAN', 'N_TH(now)', 'O_TH(now)',
    'V(now)', 'W(now)', 'X(now)', 'U(now)', 'GEO_LAYER', 'VOTES_O', 'VOTES_W', 'KNN_MED_M',
    'MAPS_URL'], undRows);

  // ---- 5) N≠V (จังหวัด) — ตัดสินแยกระดับ (ใช้ผลที่คำนวณไว้แล้ว) ----
  var nvRows = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var N_ = clStr_(row[c.N]), V_ = clStr_(row[c.V]);
    if (N_ === '' || V_ === '' || N_ === V_) continue;
    var amphoeV = vInfo[i] ? vInfo[i].verdict : '';
    nvRows.push([i + 2, clStr_(row[c.MD_ID]), N_, V_,
      clStr_(row[c.O]), clStr_(row[c.W]), nvVerdict[i], amphoeV, clStr_(row[c.AA]),
      clMapsUrl_(row[c.LAT], row[c.LNG])]);
  }
  cleanupReportTab_('P2_NV40', ['ROW', 'MD_ID', 'N_TH(now)', 'V_ไทย(now)', 'O_TH(now)',
    'W(now)', 'PROV_VERDICT', 'AMPHOE_VERDICT', 'GEO_LAYER', 'MAPS_URL'], nvRows);

  // ---- ทำจริง: เขียน U/V/W/X/AA เฉพาะแถวที่ผ่านธง (และจำกัดจำนวนถ้านำร่อง) ----
  var applied = 0, skipped = 0, runnableTotal = 0;
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
      runnableTotal++;
    }
    var limit = (pilotCount > 0) ? Math.min(pilotCount, runnableTotal) : runnableTotal;
    var done = 0;
    for (var f = 0; f < fixIdx.length && done < limit; f++) {
      var op = fixIdx[f];
      if (op.flags !== '') continue;
      colV[op.i] = op.v; colW[op.i] = op.w; colX[op.i] = op.x;
      colU[op.i] = clPostalValue_(op.u); colAA[op.i] = 'KNN_FIX';
      applied++;
      done++;
    }
    clWriteColumn_(ctx, c.U, colU);
    clWriteColumn_(ctx, c.V, colV);
    clWriteColumn_(ctx, c.W, colW);
    clWriteColumn_(ctx, c.X, colX);
    clWriteColumn_(ctx, c.AA, colAA);
  } else {
    for (var f = 0; f < fixIdx.length; f++) {
      if (fixIdx[f].flags === '') runnableTotal++;
    }
  }

  var summary = {
    apply: apply, pilot: pilotCount > 0, owTotal: owIdx.length, verdicts: verdicts,
    govcolFix: fixRows.length, runnable: runnableTotal,
    flagged: fixRows.length - runnableTotal, flagCount: flagCount,
    applied: applied, skippedFlagged: skipped,
    docside: docRows.length, undecided: undRows.length, nvRows: nvRows.length,
    seconds: Math.round((new Date() - t0) / 1000)
  };
  cleanupLog_(2, apply ? (pilotCount > 0 ? 'OK_PILOT' : 'OK') : 'DRYRUN', summary);
  cleanupToast_('เฟส 2 ' + (pilotCount > 0 ? '(นำร่อง ' + applied + ' แถว)' :
    apply ? '(ทำจริง ' + applied + ' แถว)' : '(dry-run)') +
    ': O≠W ' + owIdx.length + ' → คิวแก้ ' + fixRows.length +
    ' (ผ่านธง ' + runnableTotal + ' | ติดธง ' + (fixRows.length - runnableTotal) +
    ' ตรวจมือ)' +
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

/** ★ rev.2 — นำร่อง N แถวแรกที่ผ่านธง (ค่าตั้ง CLEANUP_CFG.PILOT_ROWS) */
function uiCleanupPhase2Pilot() {
  try {
    cleanupWithLock_(function () {
      var n = CLEANUP_CFG.PILOT_ROWS;
      if (!cleanupConfirm_('เฟส 2 — นำร่อง ' + n + ' แถว',
        'เขียน U/V/W/X + GEO_LAYER=KNN_FIX ให้ "เฉพาะ ' + n + ' แถวแรกที่ผ่านธง"\n' +
        '(แถวแรกคือ MD-0003 — ตรวจแท็บ P2_FIX คอลัมน์ MAPS_URL)\n\n' +
        'หลังรันเสร็จ: เปิด MAPS_URL เทียบ Google Maps ทุกแถว\n' +
        'ถ้าถูกหมด → กลับมากด "ทำจริง" เต็มชุด\n' +
        'ถ้าผิดแม้แต่แถวเดียว → หยุด แล้วส่งแท็บ P2_FIX มาให้ตรวจก่อน\n\n' +
        'Y และ UPDATED_AT ไม่ถูกแตะ · แนะนำสำรอง (เฟส 0) ก่อน\n\nยืนยันนำร่อง?')) {
        return 'ยกเลิก';
      }
      return cleanupPhase2(true, n);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 2 นำร่องผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase2Apply() {
  try {
    cleanupWithLock_(function () {
      if (!cleanupConfirm_('เฟส 2 — ทำจริง (เต็มชุด)',
        'เขียน U/V/W/X + GEO_LAYER=KNN_FIX ของแถว "คอลัมน์ราชการผิด" (สไตล์ MD-0003)\n' +
        '★ rev.2: เฉพาะแถวที่ผ่านธงทั้งหมด — ติดธง (KNN_THIN/KNN_FAR/NV_CONFLICT\n' +
        '   และธงโหวตเดิม) จะถูกข้ามไปเป็นคิวตรวจมือ ไม่เขียนอัตโนมัติ\n\n' +
        'แนะนำ: รัน "นำร่อง 10 แถว" + เทียบ MAPS_URL ให้ผ่านก่อนกดตรงนี้\n' +
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
