# CHANGELOG — Phaopanya Master Data

> **บันทึกการเปลี่ยนแปลงทุกเวอร์ชัน**
> **Format:** Semantic Versioning (Major.Minor.Patch)
> **อัปเดตล่าสุด (เอกสารซิงค์โค้ด):** 2026-09-03
> **Baseline แพ็กเกจนี้:** v5.5.6

## [5.5.6] — 2026-09-01 — PATCH-6 Upgrade-only + เอกสารซิงค์

### ที่มา
ปุ่ม 3/3b โหมดเก่า (latest snapshot) คัดลอกข้อความล่าสุดจาก SOURCE มาทับ `Reversegeocode` (Y)
แม้ Y จะเป็น EN สะอาดแล้วก็ตาม → ข้อมูลที่เคยดีถูกทับเป็นไทย/Plus Code

### เปลี่ยนในโค้ด
| ไฟล์ | รายการ |
|------|--------|
| `04_GeoService.gs` | `geoIsCleanEnText_`, `buildSkippedGeoRow_` (แช่แข็ง/อัปเกรด Y), `buildGeoFillRow_` กันดาวน์เกรด, `getGeoSourceIndex_` ส่ง `cleanEnByMdId`, สถิติ `yFrozen`/`yUpgraded` |
| `03_Menu.gs` | แสดง Y แช่แข็ง / Y อัปเกรด ในผลปุ่ม 3 / 3b / 1+3 |

### กติกา PATCH-6 (ตรงโค้ด)
- Y เป็น EN สะอาด (ยาวพอ, ไม่มีไทย, ไม่ใช่ Plus Code/GeoErr) → **ห้ามทับ**
- Y เป็นขยะ + SOURCE มี EN สะอาดของ MD นั้น → **อัปเกรด** พร้อม Z จากแถวเดียวกัน
- Z เติมเฉพาะช่องว่าง (ยกเว้นตอนอัปเกรด Y)
- U–X และ GEO_LAYER ของแถวที่มี layer แล้ว → แช่แข็งเหมือนเดิม

### สิ่งที่มีอยู่แล้วก่อนหน้า (ยังอยู่ในโค้ด)
- PATCH-4 `CN_ZIP_OK` / `CN_ZIP_OK_EN`
- PATCH-5 `uiClearGeoColumnsOnly`
- `06_GoogleMapsService.gs` ในโปรเจกต์เดียวกัน

### เอกสาร
ซิงค์ README / INSTALL / CHECKLIST / DEPLOYMENT / Blueprint / SHEETS_REFERENCE / PENDING ให้ตรง v5.5.6 (ไม่ขึ้นเวอร์ชันโค้ดใหม่)

---

## [5.5.3] — 2026-08-30 — Custom Functions ใช้ภาษาไทย + GeoService English path patches

### 🎯 ที่มา (รวม 2 ส่วน)

**ส่วน A — Custom Function Language Split:** ผู้ใช้ต้องการให้ Custom Functions (5 ตัว GOOGLEMAPS_*) คืนภาษาไทย
แต่ Main script (processAppSheetData / retryMissingData) ยังต้องคง **English + Strip Thai** เดิม

**ส่วน B — GeoService English path patches:** จาก Audit ของ AI ท่านอื่น พบว่า 1,572 แถว reproduce ได้ 1,572/1,572 แถว
- 115 แถวเสียเพราะ "Chang Wat" bug
- 10 แถวเสียเพราะ AMPHOE_FUZZY ชนะ LEV (เติมตำบล arbitrary)
- เสี่ยง false positive "Bang Na" → "Bang Wa" (คนละเขต)

### ✏️ ส่วนที่เปลี่ยน

#### A. 06_GoogleMapsService.gs (Section 7 เท่านั้น)

| # | ฟังก์ชัน | เดิม | ใหม่ |
|---|---------|------|------|
| 1 | `GOOGLEMAPS_LATLONG(address)` | ไม่มี setLanguage | เพิ่ม `.setLanguage('th')` + cache key เปลี่ยนเป็น `latlong,th,...` |
| 2 | `GOOGLEMAPS_ADDRESS(address)` | ไม่มี setLanguage | เพิ่ม `.setLanguage('th')` + cache key เปลี่ยนเป็น `address,th,...` |
| 3 | `GOOGLEMAPS_REVERSEGEOCODE(lat, lng)` | `.setLanguage('en')` + `mapsStripThaiChars_` | เปลี่ยนเป็น `.setLanguage('th')` + เอา stripThai ออก + cache key เปลี่ยนเป็น `reverse,th,...` |
| 4 | `GOOGLEMAPS_DISTANCE` | ไม่มี setLanguage | ไม่เปลี่ยน (Directions API ไม่รับ setLanguage) |
| 5 | `GOOGLEMAPS_DURATION` | ไม่มี setLanguage | ไม่เปลี่ยน (Directions API ไม่รับ setLanguage) |

### 🔒 สิ่งที่ "ไม่แตะ" (Main script)

| ฟังก์ชัน | setLanguage | Strip Thai | เหตุผล |
|---------|------------|------------|--------|
| `reverseGeocodeCached` (line 80, 97) | `'en'` | ✅ strip | คงเดิม — เขียนลงชีตงานต้องสะอาด |
| `processAppSheetData` | → เรียก `reverseGeocodeCached` | → strip | คงเดิม (AppSheet Bot) |
| `autoSweep` | → เรียก `reverseGeocodeCached` | → strip | คงเดิม (batch fix) |
| `retryMissingData` | → เรียก `reverseGeocodeCached` | → strip | คงเดิม (ซ่อม 300 แถว) |

### ⚠️ Plus Code Filter — เก็บไว้ทั้ง 2 ทาง

Plus Code (เช่น "PGV2+JR9") ไม่ใช่ภาษา — กรองเสมอทั้ง Main และ Custom
เพราะ Plus Code ขึ้นต้นด้วยอักษร+ตัวเลข ไม่มีไทย/อังกฤษ

### 📦 Cache Note (สำคัญ!)

Cache key เปลี่ยน → **cache เก่าจะไม่ถูกใช้**

```javascript
// เดิม: ['reverse', lat, lng]            → cache เก่า (English)
// ใหม่: ['reverse', 'th', lat, lng]     → cache ใหม่ (Thai)
```

**ผลกระทบ:**
- Custom Functions จะเรียก API ใหม่ 1 ครั้งต่อพิกัด (cache เก่าไม่ match)
- ใช้ quota เพิ่ม 1 ครั้ง — แล้ว cache ใหม่จะใช้ได้ต่อ 6 ชม.
- Main script ไม่กระทบ (key prefix ต่างกัน: `'rev:lat,lng'` vs `'reverse,th,lat,lng'`)

### 🔄 Diff สรุป (06_GoogleMapsService.gs)

```diff
- const { results: [data = null] = [] } = Maps.newGeocoder().geocode(address);  // LATLONG
+ const { results: [data = null] = [] } = Maps.newGeocoder()
+   .setLanguage('th')
+   .geocode(address);

- const { results: [data = null] = [] } = Maps.newGeocoder().geocode(address);  // ADDRESS
+ const { results: [data = null] = [] } = Maps.newGeocoder()
+   .setLanguage('th')
+   .geocode(address);

- const response = Maps.newGeocoder()
-   .setLanguage('en')
-   .reverseGeocode(latitude, longitude);  // REVERSEGEOCODE
+ const response = Maps.newGeocoder()
+   .setLanguage('th')
+   .reverseGeocode(latitude, longitude);

- addr = addr.replace(plusCodePattern, '').trim();
- addr = mapsStripThaiChars_(addr);  // เอาออก
+ addr = addr.replace(plusCodePattern, '').trim();
```

### 📊 ไฟล์ที่เปลี่ยน

| ไฟล์ | ส่วนที่เปลี่ยน |
|------|----------------|
| `06_GoogleMapsService.gs` | Header (line 5, 11) + Section 7 (line 405-485) — 3 ฟังก์ชัน |
| `CHANGELOG.md` | เพิ่ม v5.5.3 |
| `README.md` | version line |
| `INSTALL_THIS_PACKAGE.txt` | version line |
| `FILE_CHECKLIST_v5.5.3.md` | rename + content |
| `PENDING_FIXES.md` | header reference |

### ✅ Verify

- `node --check` ผ่าน 9/9 ไฟล์
- Main script: ไม่เปลี่ยน — processAppSheetData / retryMissingData / autoSweep ยังคง en + strip
- Custom Functions: 3 ตัวเปลี่ยนเป็น th + ไม่ strip
- DISTANCE/DURATION: ไม่เปลี่ยน (API limit)

### 🚀 Deploy note

1. Backup Apps Script เดิม
2. วางไฟล์ `06_GoogleMapsService.gs` ทับ
3. Reload Sheet → ทดสอบ Custom Function:
   - `=GOOGLEMAPS_REVERSEGEOCODE(13.7563, 100.5018)` → ควรได้ **ภาษาไทย**
   - `=GOOGLEMAPS_LATLONG("วังน้อย อยุธยา")` → ควรได้พิกัด
4. ทดสอบ Main: กด 🧪 Self-Test → ต้องผ่านเหมือน v5.5.2
5. กดปุ่ม 2 (Workload) → ดูว่า "ชื่อที่อยู่จาก_LatLong" ยังเป็น **อังกฤษ** (ไม่เป็นไทย)

---

#### B. 04_GeoService.gs (3 patches ใน English path)

| # | Patch | ตำแหน่ง | ผลกระทบ |
|---|-------|---------|---------|
| 1 | **Strip "Chang Wat"** | `geoExtractEn_` — หลัง province extraction | +115 แถว |
| 2 | **Reorder LEV → AMPHOE_FUZZY** | `geoMatchEn_` — matching order | +10 แถว (อัปเกรดจาก AMPHOE_FUZZY → TAMBON_LEV ถูกต้อง) |
| 3 | **`postalOk_()`** | Helper ใหม่ | กัน false positive เช่น "Bang Na" → "Bang Wa" |

**Diff 04_GeoService.gs:**

```diff
  // [v5.3 PERF] Fuzzy สำหรับ English
  let fuzzyIdx = idx.fuzzyByProv_EN || {};
  if (nt && np && fuzzyIdx[np]) {
    let f = fuzzyBest_(nt, fuzzyIdx[np], 'tn');
    if (f) return { entry: f, layer: 'TAMBON_FUZZY_EN' };
  }
+ // [v5.5.3 REORDER] TAMBON_LEV_EN มาก่อน AMPHOE_FUZZY_EN
+ if (nt && np && fuzzyIdx[np]) {
+   let f3 = levenshteinBest_(nt, fuzzyIdx[np], 'tn', 1);
+   if (f3 && postalOk_(f3, e.postal)) return { entry: f3, layer: 'TAMBON_LEV_EN' };
+ }
  if (na && np && fuzzyIdx[np]) {
    let f2 = fuzzyBest_(na, fuzzyIdx[np], 'an');
    if (f2) return { entry: f2, layer: 'AMPHOE_FUZZY_EN' };
  }
- // [v5.4.3] Levenshtein สำหรับ English (parity กับ Thai)
- if (nt && np && fuzzyIdx[np]) {
-   let f3 = levenshteinBest_(nt, fuzzyIdx[np], 'tn', 1);
-   if (f3) return { entry: f3, layer: 'TAMBON_LEV_EN' };
- }
  if (na && np && fuzzyIdx[np]) {
    let f4 = levenshteinBest_(na, fuzzyIdx[np], 'an', 1);
    if (f4) return { entry: f4, layer: 'AMPHOE_LEV_EN' };
  }
```

```diff
+ // [v5.5.3 FIX "Chang Wat"] ตัดคำนำหน้า "changwat" ออกจาก province
+ if (out.province) {
+   out.province = out.province.replace(/^chang\s*wat/, '');
+ }
```

```diff
+ /** [v5.5.3] postalOk_ — กัน false positive */
+ function postalOk_(row, postal) {
+   if (!postal) return true;
+   return String(row[GEO_COL.POSTAL] || '').trim() === String(postal).trim();
+ }
```

### 🧪 ผลทดสอบ (จาก AI audit — Python simulation 1,572 แถว)

| Metric | v5.5.2 | v5.5.3 (after patches) |
|--------|--------|------------------------|
| เติมสำเร็จ | 1,345 | **1,460** (+115) |
| ไม่ match | 151 | 12 |
| CHECK_NOTE (เว้นตาม policy) | 76 | 76 |
| อัปเกรดจาก AMPHOE_FUZZY → TAMBON_LEV | 0 | 10 (เช่น "Siriraj" → ศิริราช) |
| Regression | 0 | 0 |

### ⚠️ Verify Note

- Python simulation 1,572/1,572 ตรงเป๊ะ — **ยืนยันว่า logic ตรง**
- แต่ผู้ช่วย **ไม่ได้รัน** simulation ใหม่ — verify บน Sheet จริงหลัง deploy
- ถ้าผลแย่กว่าเดิม → restore 04_GeoService.gs (เก็บ backup ก่อน deploy)

### 🚀 Deploy (รวม 2 ส่วน)

1. Backup Apps Script เดิม (เก็บไฟล์ทั้ง 2 ไฟล์)
2. วาง `06_GoogleMapsService.gs` + `04_GeoService.gs` ทับ
3. Reload Sheet → กด 🧪 Self-Test (ต้องผ่าน ≥6 PASS)
4. ทดสอบ:
   - Custom Function: `=GOOGLEMAPS_REVERSEGEOCODE(13.7563, 100.5018)` → **ไทย**
   - กดปุ่ม 2 (Workload) → ดูจังหวัด "Samut Prakan" (ไม่ใช่ "Chang Wat Samut Prakan")
   - นับ GEO_LAYER = '' → ลดลงจาก 151 → 12

---
## [5.5.2] — 2026-08-27 — Silent-failure hardening (no new features)

### Fixed
- **UI alerts ไม่บอกว่าทำไม่ครบ:** ปุ่ม 1 / 2 / 3 / 3b / 1+3 แสดง `skipped`, `TIME_GUARD`, และคำใบ้เมื่อ filled=0 หรือ FOUND=0
- **Exception บนปุ่มหลัก:** หุ้ม try/catch แล้ว `ui.alert` ข้อความ error ชัดเจน (ยัง rethrow ให้ Execution log มี stack)
- **catch ว่างเรื่อง Cookie:** `setScgCookie_` / `getScgCookie_` / เมนูตั้ง cookie เปลี่ยนเป็น `Logger.log` แทนกลืนเงียบ
- **stats ไม่มี timeGuard:** `runMaster` และ `runDailyMatch` คืน `timeGuard` (+ `indexSource` สำหรับปุ่ม 2) ให้ UI ใช้

### Not changed
- ไม่เพิ่มฟีเจอร์ใหม่ / ไม่เปลี่ยน matching logic / ไม่เปลี่ยน schema
- RBAC ยัง fail-open เมื่อ ROLE_MAP ว่าง (ตั้งใจให้ระบบใช้ได้ก่อนใส่รายชื่อ)
- Geo no-match ยังคืนค่าว่างโดย design (ไม่ throw)

### Deploy note
1. Backup Apps Script เดิม
2. วางไฟล์จาก zip ทับ
3. Reload Sheet → กด 🧪 Self-Test
4. ลองปุ่ม 1 แล้วดูว่า alert แสดงจำนวน «ข้าม» และ TIME_GUARD (ถ้ามี)

---
## [5.5.1] — 2026-08-26 — "Critical Audit Fixes (Reset / RBAC / Self-Test / Write)"

แก้เฉพาะ FINDING จาก Deep Audit ของ v5.5.0 — ไม่เพิ่มฟีเจอร์

| ID | รายการ | ไฟล์ |
|----|--------|------|
| F-001 | resetAllMasterRefs_ ล้าง SOURCE helper ด้วย | 01_MasterService, 03_Menu |
| F-002 | ROLE_MAP เปิดแล้ว + ไม่มี email → DENY | 00_Config |
| F-003 | testPostalCoverage_ ใช้ geoMatch_(geoText) | 99_SelfTest |
| F-004 | flush dirty MASTER เป็นช่วงติดกัน | 01_MasterService |
| F-007 | uiTrimPii_ + assertRole_('editor') | 03_Menu |

Runtime ยังต้องรัน Self-Test + smoke บน Sheet จริง

------

## [5.5.0] — 2026-08-26 — "Full Key Alignment + Cache Safety + Doc Truth"

### 🎯 ที่มา
หลังเทียบ 7 zip (6 จากผู้ใช้ + 1 ของผม) — พบว่าแต่ละเวอร์ชันมีจุดเด่นคนละด้าน ไม่มีตัวไหนครบ
- v5.4.7 → เก่า ไม่มี RBAC
- v5.4.8 (35a3/mine) → +99_SelfTest + M-1 แต่ key normalize ไม่สมบูรณ์
- v5.4.9-Audit (0ace) → +assertRole_ 5 จุด แต่ไม่มี F-007
- v5.4.9-Deep (6750) → +F-007 dirty write + F-001 const→let fix แต่ไม่มี assertRole_ บน clear funcs
- v5.5.0 (d6c9) → +normSearchKey_ + PROV_ALIAS_EN + cache v55 แต่ **revert M-1** (row เดียว) และ **revert L-9** (regex เขต) และ **drop RBAC ทั้งหมด**

### 🐛 Bug Fixes ที่ v5.5.0 แก้ (รวมจุดเด่นทุก zip)

| # | ID | รายการ | ไฟล์ | แหล่ง |
|---|----|--------|------|-------|
| 1 | **v5.5.0** | `normSearchKey_/normPostalKey_` normalize key รายส่วน → แก้ dead zone "เมือง..." 1,210 แถว + "18160\|เมืองเก่า" 74 แถว | `04_GeoService.gs` | v5.5.0 (d6c9) |
| 2 | **v5.5.0** | `PROV_ALIAS_EN` — Bangkok ↔ Krung Thep Maha Nakhon (Google reverse geocode) | `04_GeoService.gs` | v5.5.0 |
| 3 | **v5.5.0** | Cache version `__v === GEO_IDX_VER (2)` + key เปลี่ยนเป็น `geo_v55_*` | `04_GeoService.gs` | v5.5.0 |
| 4 | **v5.5.0** | `GEO_CACHE_MAX_ROWS = 120` — skip stringify ถ้า rows > 120 (saves 12.9MB) | `04_GeoService.gs` | v5.5.0 |
| 5 | **M-1** | `pickRowByPostal_` — array-based bySearch/byPostal เลือก row ที่ postal ตรง (search_key ซ้ำ 97 คีย์) | `04_GeoService.gs` | **mine v5.4.8** → port กลับเข้า v5.5.0 |
| 6 | **L-9** | regex เขต negative lookahead (ไม่จับ "เขตอุตสาหกรรม") | `04_GeoService.gs` | **v5.4.9-Deep** → restore |
| 7 | **F-001** | `assertRole_`: `const email` → `let email` (TypeError → bypass) | `00_Config.gs` | v5.4.9-Deep |
| 8 | **F-002** | ROLE_MAP ว่าง = bypass / มี email = enforce | `00_Config.gs` | v5.4.9-Deep |
| 9 | **F-003** | Cookie: B1 → UserProperties + ล้าง B1 อัตโนมัติ | `00_Config.gs` + `03_Menu.gs` | v5.4.9-Deep |
| 10 | **F-007** | flush เฉพาะแถว dirty (F-007 dirtyMasterIdx) | `01_MasterService.gs` | v5.4.9-Deep |
| 11 | **F-008** | SCG 2-chunk write + rollback (all-or-nothing) | `Service_SCG.gs` | v5.4.9-Deep |
| 12 | **M-5/M-11** | resetMasterLinks ล้าง MASTER.POINTS = 0 (BUG-006 atomic) | `01_MasterService.gs` | mine v5.4.8 |
| 13 | **M-12** | maxId จาก SYS_MASTER_IDX (กัน MD-0001 reuse) + `resetAllMasterRefs_` | `01_MasterService.gs` | mine v5.4.8 |
| 14 | **L-1** | LAST_RESULT → ScriptProperty 24h TTL | `03_Menu.gs` | v5.4.9-Deep |
| 15 | **L-6** | `parseNum_` รับ comma หลายตัว | `01_MasterService.gs` | mine v5.4.8 |
| 16 | **L-7/L-8** | lat/lng range validation 5-21, 97-106 | `Service_SCG.gs` | v5.4.9-Deep |
| 17 | **H-2** | SCG cookie: PropertiesService + fallback B1 | `Service_SCG.gs` + `00_Config.gs` | v5.4.9-Deep |
| 18 | **M-3** | `assertRole_` enforcement บน destructive ops — **8 จุด** | `01_MasterService.gs` + `02_WorkloadService.gs` + `Service_SCG.gs` | v5.4.9-Audit (0ace) + mine |
| 19 | **M-4** | `trimPiiColumns_()` stub + เมนู "🛡️ Trim PII" | `00_Config.gs` + `03_Menu.gs` | mine v5.4.8 |

### ✨ Self-Test Infrastructure (จาก mine + v5.4.9-Deep)

| รายการ | ไฟล์ |
|--------|------|
| **`99_SelfTest.gs`** — 8 assertions (run ผ่านเมนู 🧪 Self-Test) | new (v5.4.8 → v5.5.0 improved) |
| 1) `testKeyAlignment_` — ตรวจ SYS_TH_GEO postal_key delimiter | |
| 2) `testCacheState_` — ตรวจ cache size < 90KB | |
| 3) `testMasterIdUniqueness_` — ตรวจ MD_ID ไม่ซ้ำ | |
| 4) `testHelperSchema_` — ตรวจ helper 4 cols + U-AA 7 cols contiguous | |
| 5) `testPostalCoverage_` — sample 100 แถว → GEO_LAYER distribution | |
| 6) `testLatLongRange_` — ตรวจ MASTER.LatLong_Actual อยู่ในไทย | |
| 7) `testPiiColumns_` — แจ้งเตือนถ้ามี PII columns | |
| 8) `testRbacConfig_` — ตรวจ assertRole_ + ROLE_MAP + try viewer | |
| เมนู "🧪 Self-Test" ใน ดูผล / รีเซ็ต | `03_Menu.gs` |
| เมนู "🔑 ตั้ง / เปลี่ยน SCG Cookie" (popup แสดงสถานะปัจจุบัน) | `03_Menu.gs` |
| เมนู "🛡️ Trim PII" | `03_Menu.gs` |
| เมนู "🗑️ Reset All Master Refs" (DANGER) | `03_Menu.gs` |

### ✅ Verify
- `node --check` ผ่าน 9/9 ไฟล์
- assertRole_() เรียก **12 จุด** ใน 5 ไฟล์ (Service_SCG=5, 99_SelfTest=2, 03_Menu=2, 00_Config=1, 01_MasterService=1, 02_WorkloadService=1)
- Cross-file refs: runSelfTestMenu_, setScgCookie_, getScgCookie_, trimPiiColumns_, resetAllMasterRefs_, pickRowByPostal_, normSearchKey_, normPostalKey_, provAliasSearchKeyEn_ — **ครบทุกตัว**
- 128 functions total, 4,940 บรรทัด
- **Runtime:** ต้องรัน 🧪 Self-Test บน Sheet จริงหลัง Deploy — ต้องเห็น ≥6 PASS, 0 FAIL

### ⚠️ Known Limitations
- Cache 90KB: v5.5.0 ใช้ in-memory + CacheService (skip stringify/put เมื่อ rows > 120) — rebuild < 5s
- RBAC stub: ถ้า `ROLE_MAP` ว่าง → bypass + log (ต้องใส่ email admin ใน 00_Config.gs)
- Fuzzy จังหวัดใหญ่ช้า — trade-off ความแม่นยำ
- M-9, M-10 (audit เก่า) — ไม่ใช่บั๊ก โค้ดถูกอยู่แล้ว

---

## [5.4.9] — 2026-08-26 — "Deep Audit FINDING fixes"

### Fixes (จาก Deep Audit)

| FINDING | รายการ | ไฟล์ |
|---------|--------|------|
| F-001 | `assertRole_`: const → let | `00_Config.gs` |
| F-002 | ROLE_MAP ว่าง = bypass / มี email = enforce | `00_Config.gs` |
| F-003 | Cookie migrate B1 → UserProperties | `00_Config.gs` + `03_Menu.gs` |
| F-007 | flush เฉพาะแถว dirty (ไม่เขียน MASTER ทั้งแผ่น) | `01_MasterService.gs` |
| F-008 | SCG 2-chunk write + rollback | `Service_SCG.gs` |
| — | Self-Test RBAC ตรวจ ROLE_MAP จริง | `99_SelfTest.gs` |

---

## [5.4.8] — 2026-08-25 — "Self-Test Driven Stability"

### ที่มา: ทำไมต้องมาแก้บั๊กซ้ำ
- ไม่มี Runtime Test → Dead Layer อยู่ได้หลายเวอร์ชัน

### ของใหม่
- **99_SelfTest.gs** — 8 assertions
- **M-1** — array-based bySearch/byPostal + `pickRowByPostal_` (97 search_key ซ้ำ)
- **M-3** — assertRole_ enforcement
- **M-4** — trimPiiColumns_ + เมนู
- **M-5/M-11** — resetMasterLinks ล้าง POINTS
- **M-12** — maxId from SYS_MASTER_IDX
- **L-1** — LAST_RESULT ScriptProperty 24h TTL
- **L-6** — parseNum_ รับ comma หลายตัว
- **L-7/L-8** — lat/lng range
- **L-9** — regex เขต negative lookahead
- **H-2** — Cookie UserProperties + fallback B1


## [5.5.4] — 2026-08-31 — CHECK_NOTE recovery + clear U-AA

### Fixed
- PATCH-4: CHECK_NOTE + postal in REV matches dict row → fill as CN_ZIP_OK / CN_ZIP_OK_EN
- PATCH-5: uiClearGeoColumnsOnly + menu item (required before re-run button 3/3b)

### Forecast (PPY_LMDS_SCGJWD_test 2669 rows)
- Fill rate 92.8% → ~98.7% after clear + 3b
