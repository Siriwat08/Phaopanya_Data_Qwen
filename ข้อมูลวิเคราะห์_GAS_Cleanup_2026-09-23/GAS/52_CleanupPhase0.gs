/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 52_CleanupPhase0.gs — เฟส 0: ตรวจสถานะก่อนล้าง + สำรองข้อมูล
 * พอร์ตจาก cleanup_0_preflight.py
 * ============================================================================
 * ทำอะไร:
 *   - ตรวจคอลัมน์จำเป็น / MD_ID ซ้ำ / STATUS / จำนวนแถว
 *   - ตัวชี้วัดคุณภาพทั้งชุด (O≠W, N≠V, เขตเขต, PII, ตัดกลางคัน, MANUAL,
 *     ชั้นสูง, Y ไทย, MATCH_KEY ซ้ำ) — เป็น baseline เทียบหลังล้าง
 *   - สำรองค่า MASTER → แท็บ BK_MASTER_* (ทุกครั้งที่รันผ่านเมนู)
 * ผลลัพธ์: แท็บ CLEANUP_STATUS + แท็บสำรอง + CLEANUP_LOG
 * ตัวเลขอ้างอิง (snapshot 2026-09-22, 11,961 แถว):
 *   O≠W 383 | N≠V 40 | เขตเขต ADDR 6,449 (RAW 6,998) | PII ชื่อ strict 420 /
 *   loose 834 | ตัดกลางคัน 22 | MANUAL 21 | ชั้นสูง 11,442 (95.7%) | Y ไทย 7,133
 * ============================================================================
 */

/**
 * เฟส 0 — ตรวจสถานะ + สำรอง
 * @param {boolean} doBackup true = สร้างแท็บสำรองก่อนตรวจ (แนะนำ)
 * @return {Object} metrics ทั้งหมด (ใช้เทียบต่อได้)
 */
function cleanupPhase0(doBackup) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;

  // ---- สำรองก่อน (ค่าเท่านั้น เร็ว ~5-10 วินาที) ----
  var bk = null;
  if (doBackup) bk = clBackupMasterTab_();

  // ---- พื้นฐาน ----
  var mdIds = {};
  var dupMd = 0;
  var statusCount = {};
  for (var i = 0; i < n; i++) {
    var md = clStr_(vals[i][c.MD_ID]);
    if (md) {
      if (mdIds[md]) dupMd++;
      else mdIds[md] = true;
    }
    var st = clStr_(vals[i][c.STATUS]) || '(ว่าง)';
    statusCount[st] = (statusCount[st] || 0) + 1;
  }

  // ---- คอลัมน์ว่าง ----
  var empty = {};
  ['N', 'O', 'U', 'V', 'W', 'X', 'Y', 'AA'].forEach(function (k) {
    var cnt = 0;
    for (var i = 0; i < n; i++) { if (clStr_(vals[i][c[k]]) === '') cnt++; }
    empty[k] = cnt;
  });

  // ---- ตัวชี้วัด ----
  var ow = 0, nv = 0, kkAddr = 0, kkRaw = 0, piiName = 0, piiLoose = 0,
      manual = 0, trunc = 0, hi = 0, yThai = 0;
  var keys = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var N_ = clStr_(row[c.N]), O_ = clStr_(row[c.O]),
        V_ = clStr_(row[c.V]), W_ = clStr_(row[c.W]);
    if (O_ !== '' && W_ !== '' && O_ !== W_) ow++;
    if (N_ !== '' && V_ !== '' && N_ !== V_) nv++;
    if (clStr_(row[c.ADDR]).indexOf('เขตเขต') >= 0) kkAddr++;
    if (clStr_(row[c.RAW_ADDRS]).indexOf('เขตเขต') >= 0) kkRaw++;
    if (clHasPhone_(row[c.NAME])) piiName++;
    if (clHasLoose_(row[c.NAME])) piiLoose++;
    if (clStr_(row[c.AA]) === 'MANUAL') manual++;
    if (clIsTruncated_(row[c.ADDR])) trunc++;
    if (CL_HIGH_LAYERS.indexOf(clStr_(row[c.AA])) >= 0) hi++;
    if (clIsThai_(row[c.Y])) yThai++;
    keys.push(clStr_(row[c.MATCH_KEY]));
  }
  var baseDup = clDupKeyCount_(keys);

  var metrics = {
    rows: n, dupMd: dupMd, status: statusCount, empty: empty,
    ow: ow, nv: nv, kkAddr: kkAddr, kkRaw: kkRaw,
    piiName: piiName, piiLoose: piiLoose, manual: manual, trunc: trunc,
    hi: hi, hiPct: Math.round(hi * 1000 / n) / 10, yThai: yThai,
    yEn: n - yThai, baseDup: baseDup, backup: bk ? bk.name : null
  };

  // ---- ประตูความปลอดภัย ----
  var gateOk = dupMd === 0;

  // ---- เขียนแท็บสถานะ ----
  var rows = [
    ['แถวทั้งหมด', n],
    ['MD_ID ซ้ำ', dupMd + (gateOk ? '  (ผ่านเกณฑ์ = 0)' : '  ★ ไม่ผ่าน — หยุดทุกเฟส')],
    ['STATUS', JSON.stringify(statusCount)],
    ['สำรองข้อมูล (แท็บค่า)', bk ? bk.name + ' (' + bk.rows + ' แถว × ' + bk.cols + ' คอลัมน์)' : '— ไม่ได้สำรองรอบนี้'],
    ['— คอลัมน์ว่าง (baseline) —', ''],
    ['PROVINCE (N) ว่าง', empty.N + ' (' + Math.round(empty.N * 1000 / n) / 10 + '%)'],
    ['AMPHOE (O) ว่าง', empty.O],
    ['ไปรษณีย์ U ว่าง', empty.U + ' (ควร = 0)'],
    ['Changwat V ว่าง', empty.V + ' (ควร = 0)'],
    ['Amphoe_Khet W ว่าง', empty.W + ' (ควร = 0)'],
    ['Tambon_Kwaeng X ว่าง', empty.X + ' (ควร = 0)'],
    ['Reversegeocode Y ว่าง', empty.Y + ' (ควร = 0)'],
    ['GEO_LAYER ว่าง', empty.AA + ' (ควร = 0)'],
    ['— ตัวชี้วัดคุณภาพ —', ''],
    ['O≠W (อำเภอขัดแย้ง)', ow + '  (เป้าหมายหลังเฟส 2: เหลือ ~277)'],
    ['N≠V (จังหวัดขัดแย้ง)', nv + '  (ต่ำกว่าเส้นแดง 50 — ยอมรับได้)'],
    ['เขตเขต ใน ADDR_CLEAN', kkAddr + '  (RAW_ADDRS: ' + kkRaw + ') — เป้าหมายเฟส 1: 0'],
    ['PII เบอร์ strict ใน NAME_CLEAN', piiName + ' (แบบหลวม 7+ หลัก: ' + piiLoose + ')'],
    ['ที่อยู่ตัดกลางคัน', trunc + '  (ส่งแก้ฝั่ง SCG — เฟส 4)'],
    ['GEO_LAYER = MANUAL', manual + '  (ค่าที่ตรวจแล้ว 09-22 = 21)'],
    ['ชั้นสูง (EXACT3*/postal*/CN*)', hi + ' (' + metrics.hiPct + '%)'],
    ['Y ภาษาไทย', yThai + ' / EN-only ' + metrics.yEn],
    ['MATCH_KEY ซ้ำเดิม', baseDup + ' (บันทึกไว้เทียบหลังเฟส 1)']
  ];
  cleanupReportTab_(CLEANUP_CFG.STATUS_SHEET, ['รายการตรวจ (เฟส 0)', 'ค่า'], rows);

  cleanupLog_(0, gateOk ? 'OK' : 'GATE_FAIL', metrics);
  cleanupToast_('เฟส 0 เสร็จ: ' + n + ' แถว · O≠W ' + ow + ' · เขตเขต ' + kkAddr +
    ' · PII ' + piiLoose + ' · ประตู ' + (gateOk ? 'ผ่าน' : 'ไม่ผ่าน (MD_ID ซ้ำ)') +
    ' · ใช้เวลา ' + Math.round((new Date() - t0) / 1000) + ' วิ');

  if (!gateOk) {
    throw new Error('ประตูความปลอดภัยไม่ผ่าน: MD_ID ซ้ำ ' + dupMd +
      ' แถว — แก้ซ้ำก่อนแล้วรันเฟส 0 ใหม่ (ดูแท็บ ' + CLEANUP_CFG.STATUS_SHEET + ')');
  }
  return metrics;
}

/** รายการที่เมนูเรียก — ตรวจ + สำรอง */
function uiCleanupPhase0() {
  try {
    cleanupWithLock_(function () { return cleanupPhase0(true); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 0 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

/** ตรวจอย่างเดียว ไม่สำรอง (เร็ว) */
function uiCleanupPhase0NoBackup() {
  try {
    cleanupWithLock_(function () { return cleanupPhase0(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 0 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
