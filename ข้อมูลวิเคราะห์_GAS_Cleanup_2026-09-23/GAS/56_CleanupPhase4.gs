/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 56_CleanupPhase4.gs — เฟส 4: แพ็กเกจร้องขอแก้ไขข้อมูลฝั่งแหล่งที่มา (SCG)
 * พอร์ตจาก cleanup_4_source_reports.py — สร้างเป็นแท็บรายงานในสเปรดชีต
 * ============================================================================
 * 3 ประเด็นที่ต้องแก้ที่ "ต้นทาง" เท่านั้น (แก้ในชีตแล้วจะถูกเขียนทับเมื่อ
 * มีการอัปเดตแถวเดียวกันจากต้นทาง):
 *   1) ที่อยู่พิมพ์ผิด 269 แถว (kNN ยืนยันคอลัมน์ราชการถูก แต่ที่อยู่ผิด)
 *   2) ที่อยู่ตัดกลางคัน 22 แถว (ปรากฏใน RAW_ADDRS ตั้งแต่ต้น = การประกอบที่อยู่ฝั่ง SCG)
 *   3) สรุป PII ที่ติดมากับชื่อ (เบอร์โทร/รหัส DN) — ของฝั่งแหล่งที่มางดส่งในฟิลด์ชื่อ
 *
 * แท็บผลลัพธ์: P4_อ่านก่อน / P4_ที่อยู่พิมพ์ผิด / P4_ตัดกลางคัน / P4_สรุปPII
 * (ส่งต่อทีม SCG ได้ทันที หรือใช้เฟส 5 แพ็กเป็นไฟล์ zip)
 * ============================================================================
 */

/**
 * เฟส 4 — สร้างแพ็กเกจ SCG (ไม่แตะชีต MASTER เลย)
 * @return {Object} สรุป
 */
function cleanupPhase4() {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;

  // ---- 1) กลุ่มที่อยู่พิมพ์ผิด: อ่านจากแท็บ P2_DOCSIDE ถ้ามี ไม่งั้นคำนวณใหม่ ----
  var docRows = [];
  var src = 'P2_DOCSIDE (จากเฟส 2)';
  var tab = cleanupReadReportTab_('P2_DOCSIDE');
  if (tab) {
    for (var i = 0; i < tab.rows.length; i++) {
      var r = tab.rows[i];
      var h = tab.headers;
      docRows.push([r[h.indexOf('ROW')], r[h.indexOf('MD_ID')],
        r[h.indexOf('NAME_CLEAN')], r[h.indexOf('ADDR_CLEAN')],
        r[h.indexOf('RAW_ADDRS')],
        r[h.indexOf('PROVINCE_TH(ผิด)')], r[h.indexOf('AMPHOE_TH(ผิด)')],
        r[h.indexOf('Changwat_ไทย(ถูก-พิกัด)')], r[h.indexOf('Amphoe_Khet_ไทย(ถูก-พิกัด)')],
        r[h.indexOf('Tambon_Kwaeng')], r[h.indexOf('ไปรษณีย์')],
        r[h.indexOf('GEO_LAYER')], r[h.indexOf('KNN_VOTES_W')]]);
    }
  } else {
    // คำนวณ kNN เอง (กรณียังไม่ได้รันเฟส 2)
    src = '(คำนวณใหม่ในเฟส 4 — แนะนำรันเฟส 2 ก่อนเพื่อเลขตรงกับที่ตรวจ)';
    var K = CLEANUP_CFG.K;
    var pool = clBuildVoterPool_(ctx);
    for (var i = 0; i < n; i++) {
      var row = vals[i];
      var O_ = clStr_(row[c.O]), W_ = clStr_(row[c.W]);
      if (O_ === '' || W_ === '' || O_ === W_) continue;
      var v = clKnnVerdict_(pool, row[c.LAT], row[c.LNG], O_, W_, K, i);
      if (v.verdict !== 'EN-side right (W matches pin)') continue;
      docRows.push([i + 2, clStr_(row[c.MD_ID]), clStr_(row[c.NAME]),
        clStr_(row[c.ADDR]), clStr_(row[c.RAW_ADDRS]),
        clStr_(row[c.N]), O_,
        clStr_(row[c.V]), W_, clStr_(row[c.X]), clStr_(row[c.U]),
        clStr_(row[c.AA]), v.vw]);
    }
  }
  cleanupReportTab_('P4_ที่อยู่พิมพ์ผิด', ['ROW', 'MD_ID', 'NAME_CLEAN',
    'ADDR_CLEAN(ผิด)', 'RAW_ADDRS(ผิด)', 'PROVINCE_TH(ผิด)', 'AMPHOE_TH(ผิด)',
    'Changwat_ไทย(ถูก-พิกัด)', 'Amphoe_Khet_ไทย(ถูก-พิกัด)', 'Tambon_Kwaeng',
    'ไปรษณีย์', 'GEO_LAYER', 'โหวตพิกัด'], docRows);

  // ---- 2) ที่อยู่ตัดกลางคัน ----
  var truncRows = [];
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    if (!clIsTruncated_(row[c.ADDR])) continue;
    truncRows.push([i + 2, clStr_(row[c.MD_ID]), clStr_(row[c.ADDR]),
      clStr_(row[c.RAW_ADDRS]), clStr_(row[c.N]), clStr_(row[c.O]),
      clStr_(row[c.V]), clStr_(row[c.W]), clStr_(row[c.AA])]);
  }
  cleanupReportTab_('P4_ตัดกลางคัน', ['ROW', 'MD_ID', 'ADDR_CLEAN(ตัด)',
    'RAW_ADDRS(ตัดด้วย-ต้นทาง)', 'PROVINCE_TH', 'AMPHOE_TH', 'Changwat_ไทย',
    'Amphoe_Khet_ไทย', 'GEO_LAYER'], truncRows);

  // ---- 3) สรุป PII ตามชนิด ----
  var piiRows = [];
  var fields = [[c.NAME, 'NAME_CLEAN'], [c.ADDR, 'ADDR_CLEAN'],
    [c.OWNER, 'OWNER_CLEAN'], [c.RAW_NAMES, 'RAW_NAMES']];
  for (var f = 0; f < fields.length; f++) {
    var colIdx = fields[f][0], tag = fields[f][1];
    var nPhone = 0, nLoose = 0;
    for (var i = 0; i < n; i++) {
      if (clHasPhone_(vals[i][colIdx])) nPhone++;
      if (clHasLoose_(vals[i][colIdx])) nLoose++;
    }
    piiRows.push([tag, nPhone, nLoose]);
  }
  cleanupReportTab_('P4_สรุปPII', ['ฟิลด์', 'เบอร์รูปแบบ 0x-xxx-xxxx', 'ตัวเลขยาว 7+ หลัก/คั่น'],
    piiRows);

  // ---- 4) แท็บอ่านก่อน ----
  var readme = [
    ['วัตถุประสงค์', 'รายการที่ต้องแก้ที่แหล่งข้อมูลต้นทาง (SCG) เพราะแก้ในชีตแล้วจะถูกเขียนทับเมื่อมีการอัปเดตแถวเดียวกันจากต้นทาง'],
    ['ชีต ที่อยู่พิมพ์ผิด', docRows.length + ' แถว — คอลัมน์ (ถูก-พิกัด) คือตำแหน่งจริงตามพิกัด (kNN 15 เพื่อนบ้าน) ใช้เป็นหลักในการแก้ที่อยู่'],
    ['ชีต ตัดกลางคัน', truncRows.length + ' แถว — ปรากฏใน RAW ตั้งแต่ต้น = การประกอบที่อยู่ฝั่ง SCG ตัดคำ (ไม่ใช่ pipeline ฝั่งเรา)'],
    ['ชีต สรุป PII', 'กรุณางดส่งเบอร์โทร/DN ในฟิลด์ชื่อ และงดตัดที่อยู่กลางคัน'],
    ['ข้อสังเกต 1', 'เบอร์โทรใน NAME_CLEAN ส่วนใหญ่เป็นรหัส DN/พนักงาน (ตัวเลขยาว 7 หลักขึ้นไป) ส่วนเบอร์จริงเป็นรูป 0x-xxx-xxxx'],
    ['ข้อสังเกต 2', 'ที่อยู่ตัดกลางคันส่วนใหญ่ยาว 52-99 อักษร ไม่ชนเพดานเดียวกัน — เช็กวิธีรวมที่อยู่หลายฟิลด์ฝั่งต้นทาง'],
    ['แหล่งข้อมูลกลุ่มที่อยู่พิมพ์ผิด', src],
    ['สร้างเมื่อ', cleanupTodayTag_() + ' โดย CLEANUP ' + CLEANUP_VERSION]
  ];
  cleanupReportTab_('P4_อ่านก่อน', ['หัวข้อ', 'รายละเอียด'], readme);

  var summary = {
    docsideRows: docRows.length, truncatedRows: truncRows.length,
    piiFields: piiRows.length, source: src,
    seconds: Math.round((new Date() - t0) / 1000)
  };
  cleanupLog_(4, 'OK', summary);
  cleanupToast_('เฟส 4 เสร็จ: ที่อยู่พิมพ์ผิด ' + docRows.length + ' | ตัดกลางคัน ' +
    truncRows.length + ' | สรุป PII 4 ฟิลด์ → แท็บ P4_* (ส่งต่อ SCG ได้)');
  return summary;
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase4() {
  try {
    cleanupWithLock_(function () { return cleanupPhase4(); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 4 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
