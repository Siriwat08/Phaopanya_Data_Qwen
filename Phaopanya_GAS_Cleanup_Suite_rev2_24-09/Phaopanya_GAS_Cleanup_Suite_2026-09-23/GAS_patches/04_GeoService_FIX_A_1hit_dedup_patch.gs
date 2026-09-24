/**
 * ============================================================================
 * PATCH TASK46-A — 04_GeoService.gs : FIX-A ลบรายการซ้ำใน 1-hit rule ฝั่ง EN
 * ----------------------------------------------------------------------------
 * เหตุผล (ยืนยันจากโค้ดที่ใช้งานจริงล่าสุด Code_Sheet.zip 22/09/2026):
 *   ฟังก์ชัน geoExtractEn_ (บริเวณบรรทัด 715-737 ของ 04_GeoService.gs ปัจจุบัน)
 *   ตรวจ amphoe/tambon แบบ 1-hit rule โดย push ชื่อที่เจอ "ทุกแถวของ pool"
 *   (pool = byProvince_EN มีทุกแถวของจังหวัด เช่น กรุงเทพฯ ~1,600 แถว)
 *   ชื่ออำเภอเดียวกันจึงถูกนับซ้ำหลายร้อยครั้ง → amphoeHits.length แทบไม่มีทาง = 1
 *   แม้ชื่อนั้นจะ match ตัวเดียวจริง ๆ → สแกนเสียประโยชน์
 *
 *   ฝั่งไทย (scanAmphoeIn_/scanTambonIn_) ไม่มีบั๊กนี้ เพราะใช้ Object.keys
 *   ของ dict (ซ้ำถูกกลืนอัตโนมัติ) — แพตช์นี้ทำให้ฝั่ง EN มีพฤติกรรมเดียวกัน
 *
 * ผลที่คาด: ชั้นสแกน EN กลับมาจับแถวที่ควรจับได้ (ข้อความไม่มี label
 *   Khet/Amphoe ชัดเจน) → เพิ่มอัตรา match ของ 3b สำหรับแถวใหม่ในอนาคต
 *
 * ⚠️ ไม่เปลี่ยนผลแถวเดิม (แถวที่มี GEO_LAYER ถูก shouldSkipEnglishGeo_ skip อยู่แล้ว)
 *    จึงวางได้ทุกเมื่อ ไม่ต้องกลัวรีเฟรชข้อมูลเก่า
 * ============================================================================
 */

/* ---------------------------------------------------------------- (วิธีวาง) --
 * ในไฟล์ 04_GeoService.gs ของโปรเจกต์ หาบล็อกนี้ (แทรกอยู่ใน geoExtractEn_
 * หลังบรรทัด "// [v5.3 PERF] ใช้ 1-hit rule เหมือน Thai path — bug #4 fix"):
 *
 *   เดิม (มีบั๊ก):
 *     if (!out.amphoe) {
 *       let amphoeHits = [];
 *       for (var j = 0; j < poolEn.length; j++) {
 *         let an = normAreaEn_(String(poolEn[j][GEO_COL.AMPHOE_NORM_EN] || ''));
 *         if (an && tLowerNoSpace.indexOf(an) >= 0) amphoeHits.push(an);
 *       }
 *       // 1-hit rule: ถ้าเจอแค่ 1 ตัว → ใช้; ถ้าเจอหลายตัว → ไม่เอา (กัน false positive)
 *       if (amphoeHits.length === 1) out.amphoe = amphoeHits[0];
 *     }
 *     if (!out.tambon) {
 *       let tambonHits = [];
 *       for (var k = 0; k < poolEn.length; k++) {
 *         let tn = normAreaEn_(String(poolEn[k][GEO_COL.TAMBON_NORM_EN] || ''));
 *         if (tn && tLowerNoSpace.indexOf(tn) >= 0) tambonHits.push(tn);
 *       }
 *       if (tambonHits.length === 1) out.tambon = tambonHits[0];
 *     }
 *
 *   แทนทั้งบล็อกด้วย:
 */

// ★ FIX-A: นับชื่อที่ "ต่างกัน" ไม่ใช่จำนวนครั้งที่ push (dedup แบบเดียวกับฝั่งไทย)
if (!out.amphoe) {
  let amphoeSeen = {};
  let amphoeHit = '', amphoeCount = 0;
  for (var j = 0; j < poolEn.length; j++) {
    let an = normAreaEn_(String(poolEn[j][GEO_COL.AMPHOE_NORM_EN] || ''));
    if (an && !amphoeSeen[an] && tLowerNoSpace.indexOf(an) >= 0) {
      amphoeSeen[an] = true;
      amphoeHit = an;
      amphoeCount++;
    }
  }
  // 1-hit rule: ชื่อที่ไม่ซ้ำกันเจอแค่ 1 ตัว → ใช้ (กัน false positive เหมือนเดิม)
  if (amphoeCount === 1) out.amphoe = amphoeHit;
}
if (!out.tambon) {
  let tambonSeen = {};
  let tambonHit = '', tambonCount = 0;
  for (var k = 0; k < poolEn.length; k++) {
    let tn = normAreaEn_(String(poolEn[k][GEO_COL.TAMBON_NORM_EN] || ''));
    if (tn && !tambonSeen[tn] && tLowerNoSpace.indexOf(tn) >= 0) {
      tambonSeen[tn] = true;
      tambonHit = tn;
      tambonCount++;
    }
  }
  if (tambonCount === 1) out.tambon = tambonHit;
}

/* ----------------------------------------------------------------------------
 * ตรวจสอบหลังวาง:
 *   1) กด Ctrl+S บันทึก แล้วรันเมนู "ดูผล / รีเซ็ต → 🧪 Self-Test" — ยังต้องผ่าน 8 รายการเหมือนเดิม
 *   2) ทดสอบเร็ว (รันใน Editor กด Run): ค่าว่าง/ไม่ error
 *        function testFixA_() {
 *          var m = geoMatchEn_('bangchak energy complex, 2 thanapoom tower, bangkok');
 *          Logger.log(m ? m.layer : 'no match');
 *        }
 *   3) ไม่ต้อง rerun ปุ่ม 3/3b ทั้งชีต — แถวเก่าถูก skip อยู่แล้ว
 *   4) แถวใหม่ที่ค้าง NO_MATCH ในอนาคตจะได้ประโยชน์จาก 1-hit ที่ทำงานจริง
 * ============================================================================
 */
