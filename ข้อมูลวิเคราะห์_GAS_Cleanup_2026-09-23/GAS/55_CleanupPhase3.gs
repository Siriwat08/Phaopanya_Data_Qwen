/**
 * ============================================================================
 * Phaopanya MASTER Cleanup Suite — Task 45
 * ไฟล์: 55_CleanupPhase3.gs — เฟส 3: เติม PROVINCE/AMPHOE แถวที่ว่าง (1,702 แถว)
 * พอร์ตจาก cleanup_3_o_empty.py
 * ============================================================================
 * พื้นฐาน (Task 43): กลุ่ม O ว่าง ตรวจ kNN แล้วสะอาด 96.2% ตามพิกัด
 *   ★ V/W เป็นภาษาไทยทั้งชีต → เติมตรง ๆ: N_new = V, O_new = W
 * เฉพาะแถว "CONSISTENT" (โหวตเพื่อนบ้าน ≥3/15 สนับสนุน W ปัจจุบัน)
 * แถวเหลือ (ชนบทไกล >5 กม. / โหวตอ่อน / ขัด 0 เสียง) → แท็บ P3_REVIEW ตรวจมือ
 *
 * ตัวเลขจากการรันจริง: O ว่าง 1,702 → เติมได้ 1,637 | ตรวจมือ 65
 *   (FAR_NEIGHBORS_GT5KM 39 · WEAK_VOTES 15 · INCONSISTENT_0_VOTES 11)
 * ============================================================================
 */

/**
 * เฟส 3 — เติม N/O แถวว่าง
 * @param {boolean} apply false = dry-run / true = เขียนคอลัมน์ PROVINCE/AMPHOE
 * @return {Object} สรุป
 */
function cleanupPhase3(apply) {
  var t0 = new Date();
  var ctx = clLoadMaster_();
  var c = ctx.col, vals = ctx.values, n = ctx.nRows;
  var K = CLEANUP_CFG.K;
  var pool = clBuildVoterPool_(ctx);

  var fillRows = [], reviewRows = [];
  var fillIdx = []; // dfIdx ที่จะเติม
  for (var i = 0; i < n; i++) {
    var row = vals[i];
    var O_ = clStr_(row[c.O]), W_ = clStr_(row[c.W]);
    if (O_ !== '' || W_ === '') continue;

    var nb = clKnnNeighbors_(pool, row[c.LAT], row[c.LNG], K, i);
    var far = nb.d.length > 0 && nb.d[nb.d.length - 1] > CLEANUP_CFG.FAR_KM;
    var vote = clVoteCount_(pool, nb.pos, 'w');
    var vw = vote.counts[W_] || 0;
    var topVoted = '';
    if (vote.order.length > 0) {
      var bestN = 0;
      for (var q = 0; q < vote.order.length; q++) {
        if (vote.counts[vote.order[q]] > bestN) {
          bestN = vote.counts[vote.order[q]];
          topVoted = vote.order[q];
        }
      }
    }

    var N_ = clStr_(row[c.N]), V_ = clStr_(row[c.V]);
    var nNew = V_, oNew = W_;

    var reason;
    if (far) reason = 'FAR_NEIGHBORS_GT5KM';
    else if (vw >= CLEANUP_CFG.MIN_VOTES) reason = 'CONSISTENT';
    else if (vw >= 1) reason = 'WEAK_VOTES';
    else reason = 'INCONSISTENT_0_VOTES';

    var rec = [i + 2, clStr_(row[c.MD_ID]), V_, W_, clStr_(row[c.X]),
      clStr_(row[c.LAT]), clStr_(row[c.LNG]), vw, topVoted, nNew, oNew];
    if (reason === 'CONSISTENT') {
      if (nNew !== '' && oNew !== '') {
        rec.push(reason);
        fillRows.push(rec);
        fillIdx.push({ i: i, n: nNew, o: oNew });
      } else {
        rec.push('V_OR_W_EMPTY');
        reviewRows.push(rec);
      }
    } else {
      rec.push(reason);
      reviewRows.push(rec);
    }
  }

  cleanupReportTab_('P3_FILL', ['ROW', 'MD_ID', 'V(now)', 'W(now)', 'X(now)', 'LAT', 'LNG',
    'W_VOTES', 'TOP_VOTED_AMPHOE', 'N_NEW_TH', 'O_NEW_TH', 'REASON'], fillRows);
  cleanupReportTab_('P3_REVIEW', ['ROW', 'MD_ID', 'V(now)', 'W(now)', 'X(now)', 'LAT', 'LNG',
    'W_VOTES', 'TOP_VOTED_AMPHOE', 'N_NEW_TH', 'O_NEW_TH', 'REASON'], reviewRows);

  // ---- ทำจริง: เขียนคอลัมน์ N/O (คงค่าเดิม เปลี่ยนเฉพาะแถว CONSISTENT) ----
  var applied = 0;
  if (apply) {
    var bad = clFindFormulas_(ctx, [c.N, c.O]);
    if (bad.length) {
      cleanupLog_(3, 'ABORT_FORMULA', { cells: bad });
      throw new Error('พบสูตรในคอลัมน์ PROVINCE/AMPHOE — ยกเลิก: ' + bad.join(', '));
    }
    var colN = new Array(n), colO = new Array(n);
    for (var i = 0; i < n; i++) {
      colN[i] = clStr_(vals[i][c.N]);
      colO[i] = clStr_(vals[i][c.O]);
    }
    for (var f = 0; f < fillIdx.length; f++) {
      colN[fillIdx[f].i] = fillIdx[f].n;
      colO[fillIdx[f].i] = fillIdx[f].o;
      applied++;
    }
    clWriteColumn_(ctx, c.N, colN);
    clWriteColumn_(ctx, c.O, colO);
  }

  var reasonCount = {};
  for (var r = 0; r < reviewRows.length; r++) {
    var rr = reviewRows[r][11];
    reasonCount[rr] = (reasonCount[rr] || 0) + 1;
  }
  var summary = {
    apply: apply, oEmptyTotal: fillRows.length + reviewRows.length,
    filled: fillRows.length, applied: applied, review: reviewRows.length,
    reviewReasons: reasonCount, seconds: Math.round((new Date() - t0) / 1000)
  };
  cleanupLog_(3, apply ? 'OK' : 'DRYRUN', summary);
  cleanupToast_('เฟส 3 ' + (apply ? '(ทำจริง ' + applied + ' แถว)' : '(dry-run)') +
    ': O ว่าง ' + summary.oEmptyTotal + ' → เติม ' + fillRows.length +
    ' | ตรวจมือ ' + reviewRows.length + ' | ' + summary.seconds + ' วิ');
  return summary;
}

/* ----------------------- เมนู ----------------------- */

function uiCleanupPhase3Dry() {
  try {
    cleanupWithLock_(function () { return cleanupPhase3(false); });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 3 (dry-run) ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}

function uiCleanupPhase3Apply() {
  try {
    cleanupWithLock_(function () {
      if (!cleanupConfirm_('เฟส 3 — ทำจริง',
        'เติม PROVINCE/AMPHOE เฉพาะแถว "CONSISTENT" (โหวตเพื่อนบ้าน ≥3)\n' +
        'ค่าที่เติม: N ← Changwat(ไทย), O ← Amphoe_Khet(ไทย)\n' +
        'ไม่แตะคอลัมน์ V/W/X และ UPDATED_AT · กลุ่มตรวจมืออยู่แท็บ P3_REVIEW\n\nยืนยัน?')) {
        return 'ยกเลิก';
      }
      return cleanupPhase3(true);
    });
  } catch (e) {
    try { SpreadsheetApp.getUi().alert('เฟส 3 ผิดพลาด: ' + e.message); } catch (e2) {}
  }
}
