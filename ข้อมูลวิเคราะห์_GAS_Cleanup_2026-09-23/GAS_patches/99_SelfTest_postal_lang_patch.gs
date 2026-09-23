/**
 * ============================================================================
 * PATCH TASK44-2 — 99_SelfTest.gs : แก้ Self-Test ผลบวกลบ (false alarm)
 * วาง 2 จุด: (A) แก้ฟังก์ชัน testPostalCoverage_  +  (B) เพิ่ม testPostalFormat_
 * ----------------------------------------------------------------------------
 * เหตุผล (ผลตรวจ Task 43, Self-Test v5.5.1 วันที่ 2026-09-21):
 *   - testPostalCoverage_ เรียก geoMatch_(geoText) ทางเดียว (สายไทย)
 *     แต่ 100 แถวแรกของ MASTER เป็น EN 100/100 → โหวต 0 ทั้งแถว → FAIL 0.0%
 *     ทั้งที่ข้อมูลดี (Grok/Anthropic เรียก "ภาษาผิดสาย")
 *   - สูตร COUNTIF(U:U,"?????") ของผู้ใช้ได้ 0 เพราะ U ถูกเก็บเป็น Number
 *     (คำอธิบาย Gemini ถูก) → ต้อง String() ก่อนเทียบ wildcard
 *
 * ผลที่คาดหลังวาง: 8 การทดสอบเดิม + 1 ใหม่ = 9 การทดสอบ
 *   testPostalCoverage_ กลับเป็น PASS (มีทั้งสายไทย/EN)
 *   testPostalFormat_   PASS (ไปรษณีย์ 11,961/11,961 เป็น 5 หลัก 100%)
 * ============================================================================
 */

/* ---------------------------------------------------------------- (A) -------
 * แก้จุดเรียก geoMatch_ ใน testPostalCoverage_ (ประมาณบรรทัด 449-467)
 * เดิม:
 *   const m = geoMatch_(geoText);
 * แทนด้วย:
 */
// ★ เลือกสายตามภาษาของ Y — แก้ Self-Test FAIL 0% จากภาษาผิดสาย
function pickGeoMatcher_(geoText) {
  const isThai = /[\u0e00-\u0e4e]/.test(geoText);
  if (isThai && typeof geoMatch_ === 'function') return geoMatch_;
  if (!isThai && typeof geoMatchEn_ === 'function') return geoMatchEn_;
  return (typeof geoMatch_ === 'function') ? geoMatch_ : geoMatchEn_;
}

/* ใน testPostalCoverage_ เปลี่ยนบรรทัด:
 *     const m = geoMatch_(geoText);
 *   เป็น:
 *     const m = pickGeoMatcher_(geoText)(geoText);
 *
 * และเปลี่ยนเงื่อนไขแจ้ง EXACT3 layer ให้รับรวมสองสายแล้ว (เดิมรับแล้ว ไม่ต้องแก้)
 */

/* ---------------------------------------------------------------- (B) -------
 * เพิ่มการทดสอบใหม่ testPostalFormat_ — วางท้ายไฟล์ 99_SelfTest.gs
 */
/**
 * Test 9 [TASK44-2]: Postal format — U (Rahatpraisanee) ต้องเป็นเลข 5 หลัก 100%
 * แก้ false alarm ของสูตร COUNTIF(U:U,"?????") ที่เทียบ Number ตรง ๆ:
 *   ต้องแปลง String() ก่อนเสมอ (Number ไม่ match wildcard ในสูตรชีต)
 */
function testPostalFormat_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SELFTEST_SHEET_MASTER);
    if (!sh || sh.getLastRow() < 2) {
      return { status: 'WARN', message: 'MASTER ว่าง — ข้าม' };
    }
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h || '').trim(); });
    const uCol = headers.indexOf('Rahatpraisanee');
    if (uCol < 0) {
      return { status: 'WARN', message: 'ไม่พบคอลัมน์ Rahatpraisanee (U)' };
    }
    const lastRow = sh.getLastRow();
    const vals = sh.getRange(2, uCol + 1, lastRow - 1, 1).getValues();

    let empty = 0, bad = 0, ok = 0;
    const badSamples = [];
    for (let i = 0; i < vals.length; i++) {
      const v = String(vals[i][0] === null || vals[i][0] === undefined ? '' : vals[i][0]).trim();
      if (v === '') { empty++; continue; }
      if (/^\d{5}$/.test(v)) { ok++; }
      else {
        bad++;
        if (badSamples.length < 5) badSamples.push('แถว ' + (i + 2) + '=' + v);
      }
    }
    const total = vals.length;
    if (empty > 0) {
      return { status: 'FAIL', message: 'ไปรษณีย์ว่าง ' + empty + '/' + total + ' แถว' };
    }
    if (bad > 0) {
      return { status: 'FAIL', message: 'รูปแบบไม่ใช่ 5 หลัก ' + bad + '/' + total +
        ' — ' + badSamples.join(', ') };
    }
    return { status: 'PASS', message: 'ไปรษณีย์ 5 หลักครบ ' + ok + '/' + total +
      ' (ตรวจแบบ String กันปัญหา Number-type)' };
  } catch (e) {
    return { status: 'FAIL', message: 'EXCEPTION: ' + e.message };
  }
}

/* ---------------------------------------------------------------- (C) -------
 * ลงทะเบียนในรายการ tests ของ runSelfTest_ (ประมาณบรรทัด 46-55):
 * เดิม:
 *     { name: 'testRbacConfig_',       fn: testRbacConfig_       }
 *   แทนด้วย:
 *     { name: 'testRbacConfig_',       fn: testRbacConfig_       },
 *     { name: 'testPostalFormat_',     fn: testPostalFormat_     }
 */

/* ============================================================================
 * หมายเหตุ: ห้ามแก้ผลตรวจด้วยการรันปุ่ม 3/3b ใหม่ทั้งชีตเพื่อให้ผลเปลี่ยน —
 * แถวที่มี GEO_LAYER ถูก shouldSkipEnglishGeo_ skip อยู่แล้ว (เป็น no-op)
 * และ 3b อ่าน geoText จากชีต SOURCE ไม่ใช่ Y ของ MASTER
 * ============================================================================ */
