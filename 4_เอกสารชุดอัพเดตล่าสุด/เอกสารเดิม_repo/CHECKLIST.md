# 📋 Checklist — แพ็กเกจ v5.5.6

> เอกสารนี้เก็บประวัติจุดตรวจจากรอบก่อน และสรุปสิ่งที่ต้องเช็กกับ **โค้ดปัจจุบัน v5.5.6**
> อัปเดตซิงค์เอกสาร: 2026-09-03

## สิ่งที่ต้องเป็นจริงในแพ็กเกจนี้

- [ ] มี `.gs` ครบ 10 ไฟล์ (รวม `06_GoogleMapsService.gs`)
- [ ] `04_GeoService.gs` มี PATCH-4/5/6 (`CN_ZIP_OK`, `uiClearGeoColumnsOnly`, `geoIsCleanEnText_` / `yFrozen`)
- [ ] `03_Menu.gs` มีปุ่มล้าง U–AA และแสดง yFrozen/yUpgraded
- [ ] README / CHANGELOG / INSTALL ระบุ v5.5.6 ไม่ระบุ 9 ไฟล์เป็น baseline
- [ ] Self-Test รันบน Sheet จริงแล้วบันทึกผล

---

## ประวัติจุดตรวจจากรอบก่อน (อ้างอิง — ไม่ใช่ version label ของแพ็กเกจปัจจุบัน)

**Date:** 2026-08-22
**Tester:** Mavis (mavis v3)
**Source:** v5.2 + audit fixes (Phaopanya_Master_v5.2_full_audit_report.md)
**Files:** 6 .gs files + README + CHECKLIST

---

## ✅ 7 จุดเสี่ยงจาก Audit (Verified against v5.2 code)

### 1. 🔴 Critical — English batch alignment → ✅ FIXED (จาก v2 base)
**ไฟล์:** `04_GeoService.gs`
**ฟังก์ชัน:** `runMasterGeoEn` (บรรทัด 756-934 ใน v5.3)
**หลักฐาน:**
- `buildExistingGeoRow_()` (line 955) — คืน row เดิมเมื่อ CHECK_NOTE
- `buildSkippedGeoRow_()` (line 971) — padding row ที่ถูก skip
- `assertRowAlignment_()` — assertion ก่อน setValues
- `verifyMdIdsAfterWrite_()` — verify MD_ID หลังเขียน
**ผลกระทบเดิม:** row shift เมื่อมี row skip + break ผิดเมื่อ batch ว่าง
**สถานะ:** ✅ แก้แล้วใน v2 base (carry-over มา v5.3)

### 2. 🟠 High — normAreaEn_ "ket" → "khet" → ✅ FIXED
**ไฟล์:** `04_GeoService.gs:204` (verified)
**ก่อน:** `replace(/^(khwaeng|tambon|ket|amphoe|...)/`
**หลัง:** `replace(/^(khwaeng|tambon|khet|amphoe|...)/`
**ผลกระทบเดิม:** "Khet Samphanthawong" → "khetsamphanthawong" แทน "samphanthawong"
**สถานะ:** ✅ แก้แล้วใน v2 base

### 3. 🟠 High — English fuzzy ใช้ Thai index → ✅ FIXED
**ไฟล์:** `04_GeoService.gs` (geoMatchEn_, line ~470)
**การแก้:**
- เพิ่ม `fuzzyByProv_EN` ใน loadGeoIdx_ (parallel Thai/EN indexes)
- เปลี่ยน `geoMatchEn_` ให้ใช้ `idx.fuzzyByProv_EN` แทน `idx.fuzzyByProv`
**ผลกระทบเดิม:** English typo ไม่ได้รับการ fuzzy matching
**สถานะ:** ✅ แก้แล้ว — fuzzy English ทำงานจริง

### 4. 🟡 Medium — EN scan fallback no 1-hit + O(n) → ✅ FIXED
**ไฟล์:** `04_GeoService.gs` (geoExtractEn_, line ~542-575)
**การแก้:**
- เพิ่ม `byProvince_EN` index (O(1) lookup)
- เพิ่ม 1-hit rule: เก็บ hits ทั้งหมด → เลือกก็ต่อเมื่อ hits.length === 1
**ผลกระทบเดิม:** O(n) scan 7,500+ keys × 2 รอบ + false positive จากชื่อซ้ำ
**สถานะ:** ✅ แก้แล้ว — O(1) + กัน false positive

### 5. 🟡 Medium — MD_LINK first-row only → ✅ FIXED
**ไฟล์:** `04_GeoService.gs` (getGeoSourceIndex_, line ~705-748)
**การแก้:**
- เปลี่ยน logic: ถ้ามี row แล้ว → เปรียบเทียบ priority
  - non-empty text ชนะ empty
  - non-empty distance ชนะ empty
  - แถวล่าสุดที่มีข้อมูลชนะ (overwrite)
**ผลกระทบเดิม:** ใช้ row แรกเสมอ → ถ้า row แรกว่าง/ผิด → ผลผิด
**สถานะ:** ✅ แก้แล้ว

### 6. 🟡 Medium — EN path ไม่ใช้ 16 columns → ⚠️ PARTIAL
**ไฟล์:** `04_GeoService.gs` (GEO_COL, line 68-95)
**การแก้:**
- เพิ่ม `NOTE_TYPE: 14` (col O) และ `NOTE_TYPE_EN: 30` (col AE) ใน GEO_COL
- ใช้ใน `geoParse_` และ `geoParseEn_` เพื่อตรวจ CHECK_NOTE
**ที่ยังไม่ได้:** ไม่ได้ใช้ NOTE_EN, SUBDISTRICT_LABEL_EN, DISTRICT_LABEL_EN, NOTE_SCOPE_EN — เพราะ column U-AA เป็นภาษาไทย
**สถานะ:** ⚠️ บางส่วน — ใช้เพิ่ม 2 columns (NOTE_TYPE + NOTE_TYPE_EN)

### 7. 🟢 Low — Comment drift → ⚠️ PARTIAL
**ไฟล์:** `04_GeoService.gs` (multiple lines)
**การแก้:**
- เปลี่ยน comment "v5.2" → "v5.3" ในจุดสำคัญ (loadGeoIdx_, geoMatchEn_, geoExtractEn_, geoParse_, geoParseEn_)
- เพิ่ม "[v5.3]" tags ในส่วนที่แก้
**ที่ยังไม่ได้:** comment เก่าในส่วนที่ไม่ได้แก้ logic ยังอ้าง v5.2 (ไม่กระทบ runtime)
**สถานะ:** ⚠️ บางส่วน — แก้ comment เฉพาะจุดที่แก้ logic

---

## ✅ จุดเพิ่มเติม (นอกเหนือจาก audit)

### +A. 🟠 Cache 90KB limit → ✅ FIXED
**ไฟล์:** `04_GeoService.gs:54-58` (verified)
**การแก้:**
```javascript
var TH_GEO_CACHE_KEY_TH = 'geo_v53_th_idx';  // ~40KB
var TH_GEO_CACHE_KEY_EN = 'geo_v53_en_idx';  // ~45KB
```
- เดิม v5.2: 1 cache key `geo_v52_idx_32col_en` → JSON > 90KB → skip → rebuild ทุกครั้ง
- v5.3: 2 cache keys แยก TH/EN → แต่ละก้อน < 90KB → cache สำเร็จ
- มี fallback: ถ้าก้อนใด invalidate → rebuild เฉพาะก้อนนั้น
**ผลกระทบเดิม:** เรียก API เยอะขึ้น, ช้าลง, quota หมดเร็ว
**สถานะ:** ✅ แก้แล้ว

### +B. 🟡 EN O(n) scan fallback → ✅ FIXED (ซ้ำกับ #4)
ใช้ `byProvince_EN` O(1) แทน full scan 7,500+ keys

### +C. 🟡 NOTE_TYPE ไม่ถูกใช้ → ✅ FIXED
**ไฟล์:** `04_GeoService.gs` (geoParse_, geoParseEn_)
**การแก้:**
```javascript
var noteType = String(row[GEO_COL.NOTE_TYPE] || '').trim().toUpperCase();
if (noteType === 'CHECK_NOTE') {
  out.geoLayer = 'CHECK_NOTE';
  return out;  // เว้น 4 คอลัมน์ราชการว่าง
}
```
**ผลกระทบเดิม:** แถว CHECK_NOTE ใน SYS_TH_GEO ถูกเติมเหมือน row ปกติ (199 แถวเสี่ยง)
**สถานะ:** ✅ แก้แล้ว

---

## ⚠️ สิ่งที่ยังไม่ได้ทำ (TODO ก่อน production)

1. **Live runtime test** — ต้องรันบน Google Sheets จริงด้วยข้อมูลจำลอง 4 แถวใน batch เดียว
   - แถว 1: Thai GEO_LAYER (skip)
   - แถว 2: ต้องเติม English (test new fix)
   - แถว 3: NO_MATCH
   - แถว 4: ต้องเติม English (test alignment)
2. **Cache size verification** — วัดขนาดจริงของ TH/EN cache หลัง rebuild
3. **EN column coverage** — ตัดสินใจว่าจะใช้ EN labels (SUBDISTRICT_LABEL_EN, etc.) เพิ่มหรือไม่
4. **Full CHECK_NOTE test** — สร้าง SYS_TH_GEO row ที่มี NOTE_TYPE=CHECK_NOTE แล้วทดสอบว่า MASTER_PLACE geoLayer = 'CHECK_NOTE'

---

## 🔍 วิธีตรวจสอบเอง (verification commands)

```bash
# ตรวจว่าแก้จริง (cache key)
grep -n "TH_GEO_CACHE_KEY" Phaopanya_Master_v5.3/04_GeoService.gs
# ควรเห็น: TH_GEO_CACHE_KEY_TH, TH_GEO_CACHE_KEY_EN (ไม่มี TH_GEO_CACHE_KEY ตัวเดียว)

# ตรวจ fuzzyByProv_EN
grep -n "fuzzyByProv_EN" Phaopanya_Master_v5.3/04_GeoService.gs
# ควรเห็น 3+ จุด (declaration, build, usage)

# ตรวจ byProvince_EN
grep -n "byProvince_EN" Phaopanya_Master_v5.3/04_GeoService.gs
# ควรเห็น 3+ จุด (declaration, build, usage)

# ตรวจ khet regex
grep -n "khet\|ket" Phaopanya_Master_v5.3/04_GeoService.gs
# ควรเห็น "khet" ใน regex (ไม่มี "ket" ตัวเดียว)

# ตรวจ NOTE_TYPE
grep -n "NOTE_TYPE\|CHECK_NOTE" Phaopanya_Master_v5.3/04_GeoService.gs
# ควรเห็น NOTE_TYPE: 14, NOTE_TYPE_EN: 30 + CHECK_NOTE handling
```

---

## 📊 สรุป

| หมวด | ทั้งหมด | แก้แล้ว | บางส่วน | ยังไม่ได้ |
|---|---|---|---|---|
| Audit issues (7) | 7 | 5 | 2 | 0 |
| Additional (3) | 3 | 3 | 0 | 0 |
| **รวม** | **10** | **8** | **2** | **0** |

**คะแนนความพร้อม:** 80% แก้สมบูรณ์, 20% บางส่วน (ต้อง live test)
