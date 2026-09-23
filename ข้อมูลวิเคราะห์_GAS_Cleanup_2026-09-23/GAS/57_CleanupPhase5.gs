/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 57_CleanupPhase5.gs — เฟส 5: ส่งออกไฟล์เบา <3MB ไป Google Drive
 * พอร์ตจาก cleanup_5_slim_export.py — แก้ปัญหาแนบไฟล์ใหญ่เกิน 3MB
 * ============================================================================
 * 3 โหมด:
 *   rows : เฉพาะแถวปัญหา (รวมสหภาพ MD_ID จากแท็บรายงานทุกเฟส) + คอลัมน์หลัก
 *          — ตัวเลขรันจริง: 475 แถว ≈ 0.38 MB (ต่ำกว่า 3MB มาก)
 *   cols : ทั้งชีตแต่ตัดคอลัมน์ RAW (RAW_NAMES/RAW_ADDRS ยาวสุด)
 *   zip  : รวมแท็บรายงานทุกแท็บ (P1/P2/P3/P4/CLEANUP_*) เป็น zip เดียว
 *
 * ทุกโหมด: สร้างไฟล์ใน Drive ของบัญชีที่รัน + เปิดแชร์ "ทุกคนที่มีลิงก์"
 * (ถ้าองค์กรห้ามแชร์สาธารณะ ไฟล์ยังอยู่ใน Drive — กดแชร์เองได้)
 * คัดลอก URL จากแท็บ CLEANUP_STATUS เพื่อส่งต่อในแชท/อีเมล
 * ============================================================================
 */

/** คอลัมน์ที่ส่งออกในโหมด rows (เหมือนชุด Python) */
var CL_SLIM_HEADERS = ['ROW', 'MD_ID', 'NAME_CLEAN', 'ADDR_CLEAN', 'RAW_NAMES',
  'RAW_ADDRS', 'PROVINCE', 'AMPHOE', 'Rahatpraisanee', 'Changwat', 'Amphoe_Khet',
  'Tambon_Kwaeng', 'Reversegeocode', 'GEO_LAYER', 'UPDATED_AT'];

/** แท็บรายงาน "แถวที่ต้องตัดสินใจ" สำหรับรวมสหภาพโหมด rows
 *  (P1_DUP ใช้เฉพาะ KEEP_MD_ID — ตรงชุด Python ที่ได้ 475 แถว) */
var CL_PROBLEM_TABS = [
  ['P2_FIX', 'MD_ID'],
  ['P2_DOCSIDE', 'MD_ID'],
  ['P2_UNDECIDED', 'MD_ID'],
  ['P2_NV40', 'MD_ID'],
  ['P3_REVIEW', 'MD_ID'],
  ['P1_DUP', 'KEEP_MD_ID']
];

/** เฟส 5 โหมด rows — รวมแถวปัญหาจากทุกเฟส → CSV+zip → Drive */
function cleanupPhase5Rows() {
  var t0 = new Date();
  var ids = {};
  var used = [];
  for (var t = 0; t < CL_PROBLEM_TABS.length; t++) {
    var tabName = CL_PROBLEM_TABS[t][0], idCol = CL_PROBLEM_TABS[t][1];
    var tab = cleanupReadReportTab_(tabName);
    if (!tab) continue;
    var h = tab.headers;
    var iId = h.indexOf(idCol);
    if (iId < 0) continue;
    var got = 0;
    for (var i = 0; i < tab.rows.length; i++) {
      var id = String(tab.rows[i][iId] || '').trim();
      // P1_DUP DELETE_MD_ID อาจมีหลายค่าคั่นด้วย ;
      var parts = id.indexOf(';') >= 0 ? id.split(';') : [id];
      for (var p = 0; p < parts.length; p++) {
        var one = parts[p].trim();
        if (one && !ids[one]) { ids[one] = true; }
      }
    }
    if (got || tab.rows.length) used.push(tabName + '(' + tab.rows.length + ')');
  }

  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var idCount = Object.keys(ids).length;
  if (idCount === 0) {
    // ไม่มีแท็บรายงาน → ใช้เกณฑ์ O≠W แทน (เหมือน Python)
    for (var i = 0; i < n; i++) {
      var O_ = clStr_(vals[i][c.O]), W_ = clStr_(vals[i][c.W]);
      if (O_ !== '' && W_ !== '' && O_ !== W_) ids[clStr_(vals[i][c.MD_ID])] = true;
    }
    used.push('(fallback O≠W)');
  }

  var rows = [];
  for (var i = 0; i < n; i++) {
    var md = clStr_(vals[i][c.MD_ID]);
    if (!ids[md]) continue;
    var row = vals[i];
    rows.push([i + 2, md, clStr_(row[c.NAME]), clStr_(row[c.ADDR]),
      clStr_(row[c.RAW_NAMES]), clStr_(row[c.RAW_ADDRS]),
      clStr_(row[c.N]), clStr_(row[c.O]), clStr_(row[c.U]), clStr_(row[c.V]),
      clStr_(row[c.W]), clStr_(row[c.X]), clStr_(row[c.Y]), clStr_(row[c.AA]),
      clStr_(row[c.UPDATED])]);
  }

  var csv = clBuildCsv_(CL_SLIM_HEADERS, rows);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  var res = clSaveToDrive_(csv, 'Master_problem_rows_' + rows.length + '_' + stamp + '.csv',
    'text/csv; charset=UTF-8');

  // บันทึก URL ลงแท็บสถานะให้คัดลอกง่าย
  cleanupReportTab_(CLEANUP_CFG.STATUS_SHEET, ['รายการ', 'ค่า'], [
    ['ส่งออกโหมด rows', cleanupTodayTag_() + ' ' + CLEANUP_VERSION],
    ['แถวปัญหา', rows.length + ' แถว'],
    ['แหล่งรวม', used.join(', ')],
    ['ขนาดโดยประมาณ', Math.round(csv.length / 1024 / 10.24) / 100 + ' MB (ก่อน zip)'],
    ['ลิงก์ดาวน์โหลด', res.url]
  ]);
  cleanupLog_(5, 'OK', { mode: 'rows', rows: rows.length, sources: used, url: res.url });
  cleanupToast_('เฟส 5 (rows): ' + rows.length + ' แถว → ' + res.url +
    ' — URL อยู่แท็บ ' + CLEANUP_CFG.STATUS_SHEET + ' ด้วย');
  return { rows: rows.length, url: res.url, sources: used,
    seconds: Math.round((new Date() - t0) / 1000) };
}

/** เฟส 5 โหมด cols — ทั้งชีตตัดคอลัมน์ RAW ออก */
function cleanupPhase5Cols() {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col;
  var headers = ctx.headers.slice(); // สำเนา
  var dropIdx = [headers.indexOf('RAW_NAMES'), headers.indexOf('RAW_ADDRS')];
  var keep = [];
  for (var h = 0; h < headers.length; h++) {
    if (dropIdx.indexOf(h) < 0) keep.push(h);
  }
  var outHeaders = keep.map(function (i) { return headers[i]; });
  var rows = [];
  for (var i = 0; i < ctx.nRows; i++) {
    var line = [];
    for (var k = 0; k < keep.length; k++) line.push(clStr_(ctx.values[i][keep[k]]));
    rows.push(line);
  }
  var csv = clBuildCsv_(outHeaders, rows);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  var res = clSaveToDrive_(csv, 'Master_no_raw_' + stamp + '.csv', 'text/csv; charset=UTF-8');
  cleanupLog_(5, 'OK', { mode: 'cols', rows: rows.length, cols: outHeaders.length, url: res.url });
  cleanupToast_('เฟส 5 (cols): ' + rows.length + ' แถว × ' + outHeaders.length +
    ' คอลัมน์ → ' + res.url);
  return { rows: rows.length, cols: outHeaders.length, url: res.url,
    seconds: Math.round((new Date() - t0) / 1000) };
}

/** เฟส 5 โหมด zip — รวมทุกแท็บรายงานของชุดนี้เป็น zip เดียว */
function cleanupPhase5Zip() {
  var t0 = new Date();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = [];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var nm = sheets[i].getName();
    if (/^(P[1-4]_|P_SEARCH|CLEANUP_|BK_MASTER_)/.test(nm)) names.push(nm);
  }
  if (names.length === 0) throw new Error('ยังไม่มีแท็บรายงานของชุดนี้ — รันเฟสต่าง ๆ ก่อน');
  var blobs = [];
  for (var j = 0; j < names.length; j++) {
    var sh = ss.getSheetByName(names[j]);
    if (!sh || sh.getLastRow() < 1) continue;
    var vals = sh.getDataRange().getValues();
    var csv = clBuildCsv_(vals[0].map(function (h) { return clStr_(h); }),
      vals.slice(1));
    blobs.push(Utilities.newBlob(csv, 'text/csv; charset=UTF-8',
      names[j].replace(/[\\\/?%*:|"<>=]/g, '_') + '.csv'));
  }
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  var zip = Utilities.zip(blobs, 'Cleanup_reports_' + stamp + '.zip');
  var file = DriveApp.createFile(zip);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  cleanupLog_(5, 'OK', { mode: 'zip', tabs: names.length, url: file.getUrl() });
  cleanupToast_('เฟส 5 (zip): รวม ' + names.length + ' แท็บ → ' + file.getUrl());
  return { tabs: names.length, url: file.getUrl(),
    seconds: Math.round((new Date() - t0) / 1000) };
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase5Rows() {
  try { cleanupWithLock_(function () { return cleanupPhase5Rows(); }); }
  catch (e) { try { SpreadsheetApp.getUi().alert('เฟส 5 (rows) ผิดพลาด: ' + e.message); } catch (e2) {} }
}

function uiCleanupPhase5Cols() {
  try { cleanupWithLock_(function () { return cleanupPhase5Cols(); }); }
  catch (e) { try { SpreadsheetApp.getUi().alert('เฟส 5 (cols) ผิดพลาด: ' + e.message); } catch (e2) {} }
}

function uiCleanupPhase5Zip() {
  try { cleanupWithLock_(function () { return cleanupPhase5Zip(); }); }
  catch (e) { try { SpreadsheetApp.getUi().alert('เฟส 5 (zip) ผิดพลาด: ' + e.message); } catch (e2) {} }
}
