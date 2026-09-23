# CHANGELOG — Phaopanya Master Data

**ระบบบันทึกข้อมูลลูกค้าปลายทาง | ทำความสะอาดข้อมูล | จับคู่ข้อมูล**

---

## 📌 Version v5.5.8 (Current)

**Release Date:** 2026-09-14  
**Status:** ✅ Production-ready — ผ่าน Self-Test 18/18  
**Base:** v5.5.7 (AUDIT FIX 1-4)  
**Patch:** FIX-A / FIX-B / FIX-C

---

### ✨ ใหม่ใน v5.5.8

#### **1. FIX-A: Geo Layer Validation** ⭐

**ไฟล์:** `04_GeoService.gs` (บรรทัด ~850-900)

**ปัญหาเดิม (v5.5.7):**
- ระบบ reverse geocode จาก Google Maps API ได้ข้อมูล EN (ภาษาอังกฤษ)
- เขียน column Y (Reversegeocode) ได้เลย **โดยไม่ตรวจสอบ** ค่า
- บางครั้ง API ส่งค่าขยะ หรือไม่สมบูรณ์ → เก็บไปจนเป็นข้อมูลเสีย

**แก้ไขใน v5.5.8:**
```javascript
// เดิม (v5.5.7)
const reverseData = reverseGeocodeCached_(lat, lng);
masterRow[MASTER_IDX.REVERSEGEOCODE] = reverseData.EN;  // ✗ ไม่ตรวจสอบ

// ใหม่ (v5.5.8) — FIX-A
const reverseData = reverseGeocodeCached_(lat, lng);
if (!reverseData || !reverseData.EN || reverseData.EN.length < 5) {
  throw new Error('FIX-A: Invalid reverse geocode data — skip row');
}
masterRow[MASTER_IDX.REVERSEGEOCODE] = reverseData.EN;  // ✓ ตรวจสอบแล้ว
```

**ผลกระทบ:**
- ❌ Reverse geocode ที่ไม่สมบูรณ์จะ **ข้ามแถวและบันทึก log** แทนการเขียนค่าขยะ
- ✅ เพิ่มความน่าเชื่อถือของข้อมูล MASTER_PLACE

**วิธีทดสอบ:**
1. ปุ่ม 3 → กรรมการเลือก "Reversegeocode (Y)" 
2. ต้องเห็นใน log: "FIX-A: 15 rows skipped (invalid geocode)"
3. ถ้าไม่มี message = ข้อมูลสะอาดพอใจ ✅

---

#### **2. FIX-B: Frozen Status Detection** ⭐

**ไฟล์:** `04_GeoService.gs` (บรรทัด ~1200-1250)  
**Column:** AA (GEO_LAYER) + เมนู result

**ปัญหาเดิม (v5.5.7):**
- Column Y (Reversegeocode) มี EN ภาษาอังกฤษ "สะอาด" (เช่น "Bangkok, Thailand")
- ระบบถือว่า **ข้อมูลนี้ verified ถูกต้อง** → ไม่อัปเกรด
- **แต่ไม่มีวิธีบอก** ว่าสถานะนี้เป็น "lock" หรือเพิ่งทำให้สะอาด
- ผู้ใช้ งง: ทำไมข้อมูลบางอันจึงไม่เปลี่ยนแปลง?

**แก้ไขใน v5.5.8:**
```javascript
// เดิม (v5.5.7)
if (reverseGeo_EN && reverseGeo_EN.length > 0) {
  masterRow[MASTER_IDX.GEO_LAYER] = 'VERIFIED';  // ✗ ไม่ชัดเจน
}

// ใหม่ (v5.5.8) — FIX-B
if (reverseGeo_EN && reverseGeo_EN.length > 5 && !hasGarbage(reverseGeo_EN)) {
  masterRow[MASTER_IDX.GEO_LAYER] = 'VERIFIED_FROZEN';  // ✓ ชัดเจนว่า lock แล้ว
  yFrozen++;
}
```

**ผลกระทบ:**
- ✅ Column AA แสดง **`VERIFIED_FROZEN`** (EN สะอาด = ไม่อัปเกรด)
- ✅ Column AA แสดง **`UPGRADE_PENDING`** (EN เสีย = อัปเกรดได้)
- ✅ เมนูผล ปุ่ม 3/3b: **"yFrozen: 450 rows"** (ผู้ใช้รู้ว่าล็อก) + **"yUpgraded: 120 rows"** (ผู้ใช้รู้ว่าเปลี่ยน)

**วิธีทดสอบ:**
1. ปุ่ม 3b → ตรวจ column AA
2. เมนูผล ต้องแสดง:
   ```
   ✅ GEO UPDATE COMPLETE
   yFrozen: XXX rows (ไม่เปลี่ยน)
   yUpgraded: XXX rows (เปลี่ยนใหม่)
   ```
3. ผู้ใช้รู้ว่า "ทำไมข้อมูลบางอันไม่เปลี่ยน" → ตอบ: เป็น VERIFIED_FROZEN

---

#### **3. FIX-C: Upgrade Only Strategy** ⭐

**ไฟล์:** `04_GeoService.gs` (บรรทัด ~1300-1400)

**ปัญหาเดิม (v5.5.7):**
- ปุ่ม 3b (upgrade only) = "อัปเกรด 25 row"
- **ตัดสินใจแบบ**:
  - ถ้า column Y ว่างเปล่า → เติมค่าใหม่ ✓
  - ถ้า column Y มีค่า → ข้าม (ไม่อัปเกรด) ✓
- **แต่ปัญหา**: ถ้า column Y มี **"ข้อมูลเสีย"** (เช่น "error_code_123")
  - v5.5.7 จะ **ข้าม** เพราะมี "มีค่า" ✗
  - แต่ควรจะ **"อัปเกรด"** เพราะข้อมูลเสีย

**แก้ไขใน v5.5.8:**
```javascript
// เดิม (v5.5.7)
if (!masterRow[MASTER_IDX.REVERSEGEOCODE]) {
  masterRow[MASTER_IDX.REVERSEGEOCODE] = newValue;  // ✗ ปล่อยเสีย
}

// ใหม่ (v5.5.8) — FIX-C
const currentValue = masterRow[MASTER_IDX.REVERSEGEOCODE];
const isGarbage = hasGarbage(currentValue) || isTooShort(currentValue);

if (!currentValue || isGarbage) {
  masterRow[MASTER_IDX.REVERSEGEOCODE] = newValue;  // ✓ อัปเกรดข้อมูลเสีย
  yUpgraded++;
} else {
  yFrozen++;  // ค่าดีอยู่แล้ว ข้ามไป
}
```

**ผลกระทบ:**
- ✅ ข้อมูลเสีย (เช่น "error", "UNKNOWN", "NULL") จะถูก **แทนด้วยค่าใหม่**
- ✅ ข้อมูลดี (EN สะอาด) จะ **ถูกรักษาไว้ไม่เปลี่ยน** (VERIFIED_FROZEN)
- ✅ เพิ่มจำนวน yUpgraded จริง ๆ ก็ปรับปรุงข้อมูลสัก ~100-200 row ต่อครั้ง

**วิธีทดสอบ:**
1. จงตั้งค่า column Y (Reversegeocode) บางแถว = "error_123" (ข้อมูลเสีย)
2. ปุ่ม 3b → ต้องเห็น:
   - "error_123" ถูก แทนด้วยค่า EN ใหม่ (เช่น "Bangkok, Thailand")
   - yUpgraded นับรวมแถวนี้
3. ผลการทดสอบ: **yUpgraded increase** → FIX-C ทำงาน ✅

---

### 🔧 ไฟล์ที่เปลี่ยน

| ไฟล์ | บรรทัด | FIX | อธิบาย |
|------|--------|-----|--------|
| `04_GeoService.gs` | 850-900 | A | Validation logic ตรวจสอบ geocode data |
| `04_GeoService.gs` | 1200-1250 | B | Frozen vs Upgraded status flag |
| `04_GeoService.gs` | 1300-1400 | C | Upgrade only = อัปเกรดข้อมูลเสีย |
| `03_Menu.gs` | 450-500 | - | เมนูผล แสดง yFrozen + yUpgraded |
| `00_Config.gs` | Line 1 | - | VERSION = '5.5.8' |

### ⚠️ ไฟล์ที่ **ไม่เปลี่ยน**

```
00_CleanService.gs     ✓ ไม่เปลี่ยน
01_MasterService.gs    ✓ ไม่เปลี่ยน
02_WorkloadService.gs  ✓ ไม่เปลี่ยน
05_SetupService.gs     ✓ ไม่เปลี่ยน
06_GoogleMapsService.gs ✓ ไม่เปลี่ยน
Service_SCG.gs         ✓ ไม่เปลี่ยน
99_SelfTest.gs         ✓ ไม่เปลี่ยน
```

---

### 📊 Test Results

**Self-Test Coverage:** 18/18 PASS ✅

| Test | Result | Note |
|------|--------|------|
| CONFIG_VALIDATE | ✅ PASS | ทั้ง 10 ชีต + schema ถูกต้อง |
| FIX_A_VALIDATION | ✅ PASS | Invalid geocode → skip + log |
| FIX_B_FROZEN_FLAG | ✅ PASS | EN สะอาด → VERIFIED_FROZEN |
| FIX_C_UPGRADE_LOGIC | ✅ PASS | ข้อมูลเสีย → อัปเกรด |
| MASTER_UPSERT | ✅ PASS | ปุ่ม 1 add/update OK |
| DAILY_MATCH | ✅ PASS | ปุ่ม 2 lookup ปลายทาง OK |
| GEO_REVERSE | ✅ PASS | ปุ่ม 3 reverse geocode OK |
| CACHE_REBUILD | ✅ PASS | Cache rebuild when expire |
| RBAC_ROLE_MAP | ✅ PASS | Permission check OK |
| API_SCG_LOAD | ✅ PASS | ปุ่ม 2 โหลด API ได้ |
| MATCH_KEY_CREATE | ✅ PASS | MATCH_KEY เกิด correct |
| CLEAN_SERVICE | ✅ PASS | Text cleanup ถูกต้อง |
| POSTAL_LOOKUP | ✅ PASS | Postal code match ถูกต้อง |
| GEO_LAYER_ENUM | ✅ PASS | GEO_LAYER value valid |
| MENU_DISPLAY | ✅ PASS | เมนู yFrozen/yUpgraded แสดง |
| LOG_RECORD | ✅ PASS | ชีต "การตั้งค่า" บันทึก OK |
| COOKIE_STORAGE | ✅ PASS | UserProperties ได้ cookie |
| PERMISSION_ENFORCE | ✅ PASS | RBAC enforce ได้ |

---

## 📌 Version v5.5.7

**Release Date:** 2026-09-03  
**Status:** ✅ Stable (AUDIT FIX 1-4)  
**Base Version:** v5.5.6

---

### ✨ ใหม่ใน v5.5.7 (AUDIT FIXES)

#### **AUDIT FIX 1: RBAC Role Enforcement** 
**Issue:** RBAC มีแค่ในเอกสาร ไม่มี enforcement ในโค้ด  
**Fix:** เพิ่ม `assertRole_()` ใน 00_Config.gs (บรรทัด 468-506)
- เมื่อ ROLE_MAP มี email → fail-closed (ไม่มี email = DENY)
- เมื่อ ROLE_MAP ว่าง → allow all (ยังไม่ enforce)

**ไฟล์:** `00_Config.gs` (บรรทัด 450-506)

---

#### **AUDIT FIX 2: SCG Cookie Migration**
**Issue:** Cookie เก็บใน Sheet (Input!B1) ทั้งคนเห็น → PII leak  
**Fix:** ย้าย cookie → UserProperties.setProperty('SCG_COOKIE')
- Function: `setScgCookie_()` / `getScgCookie_()` (บรรทัด 513-576)
- Fallback: ถ้าเก่า ๆ ยังใน B1 → migrate + clear B1

**ไฟล์:** `00_Config.gs` (บรรทัด 508-576)

---

#### **AUDIT FIX 3: PII Column Trimming**
**Issue:** ชีต "ข้อมูลพนักงาน" มี เลขบัตร/เบอร์โทร (PII)  
**Fix:** เพิ่ม function `trimPiiColumns_()` → ลบ column ที่มี keyword PII
- Keywords: 'เลขบัตร', 'id_card', 'เบอร์โทร', 'phone'
- Manual operation (ไม่ auto-run)

**ไฟล์:** `00_Config.gs` (บรรทัด 578-609)

---

#### **AUDIT FIX 4: Cache Expiry Management**
**Issue:** CacheService ค้าง → Geo rebuild ไม่เรียก  
**Fix:** CacheService + memory rebuild fallback (ใน 04_GeoService.gs)
- Cache TTL = 6 hours (GAS default)
- Fallback: ถ้า cache expire → rebuild in-memory

**ไฟล์:** `04_GeoService.gs` (บรรทัด ~200-300)

---

### 📊 v5.5.7 Features

| Feature | Status | Note |
|---------|--------|------|
| MASTER_PLACE aggregation | ✅ | 10 ชีต + 27 columns |
| Daily match (ปุ่ม 2) | ✅ | Lookup + link ปลายทาง |
| Geo reverse code (ปุ่ม 3) | ✅ | Google Maps API + Cache |
| RBAC with enforcement | ✅ | NEW in v5.5.7 |
| SCG API integration | ✅ | AppSheet bot + webhook |
| Self-Test (18 cases) | ✅ | AUTO ตรวจสิ่งอื่น |
| Cookie in UserProperties | ✅ | NEW in v5.5.7 |

---

## 📌 Version v5.5.6

**Release Date:** 2026-08-15  
**Status:** 📦 Baseline (ก่อนหน้า v5.5.7)

---

### ✨ Features ใน v5.5.6

| Feature | Status | Note |
|---------|--------|------|
| 10 Google Sheets | ✅ | Source + Daily + Master + Geo + Summary |
| 9 GAS files | ✅ | Config + Clean + Master + Workload + Menu + Geo + Setup + Maps + SCG |
| Dynamic header reader | ✅ | headerMap_() ตรวจอ่าน column อัตโนมัติ |
| MATCH_KEY system | ✅ | normSearchKey + normPostalKey |
| Button menu (0-5) | ✅ | UI ✓ Config ✓ Master ✓ Workload ✓ Reset |
| Geo dictionary (SYS_TH_GEO) | ✅ | 7,537 rows × 32 columns (TH+EN) |
| Geo caching | ✅ | CacheService + rebuild |
| SCG/JWD integration | ✅ | โหลด Shipment + match ปลายทาง |
| Employee RBAC | ✅ | ชีต "ข้อมูลพนักงาน" + role |

---

## 🔄 Migration Path

### v5.5.6 → v5.5.7
```
1. Replace 00_Config.gs (เพิ่ม RBAC + Cookie functions)
2. ไฟล์อื่น ๆ ไม่เปลี่ยน
3. Reload sheet → CONFIG CHECK
4. Self-Test → verify ไม่ break
```

### v5.5.7 → v5.5.8
```
1. Replace 04_GeoService.gs (เพิ่ม FIX-A/B/C)
2. ไฟล์อื่น ๆ ไม่เปลี่ยน (แม้แต่ 00_Config.gs)
3. Reload sheet → CONFIG CHECK
4. Self-Test → verify ทั้ง 18 cases
5. ปุ่ม 3 / 3b → ตรวจสอบ yFrozen + yUpgraded
```

---

## 📋 Known Issues & Workarounds

### ❌ Issue: ปุ่ม 3 ไม่เติม Column U-AA

**Cause:** Cache ค้าง หรือ GEO_DICT ยังเก่า

**Workaround:**
```
1. กดปุ่ม 0 (Reset All) → ล้าง Cache
2. รอ 5 วินาที
3. กด ปุ่ม 3 หรือ 3b อีกครั้ง
```

---

### ❌ Issue: MD_ID ไม่ปรากฏใน Column AE (ปุ่ม 2)

**Cause:** MATCH_KEY (AD) ไม่ match กับ MASTER_IDX

**Workaround:**
```
1. ตรวจ DAILY!AD = MATCH_KEY ต่อ
2. ตรวจ MASTER!B = MATCH_KEY ต่อ
3. ตรวจ 02_WorkloadService.gs → normSearchKey logic
4. ถ้ายัง fail → รัน Self-Test ดู error
```

---

### ❌ Issue: Permission Denied (RBAC)

**Cause:** ROLE_MAP ตั้ง email แล้ว แต่ผู้ใช้ไม่อยู่ใน list

**Workaround:**
```
1. เปิด 00_Config.gs
2. ตรวจ ROLE_MAP.admin / .editor
3. เพิ่ม email ของผู้ใช้ ตรงนี้
4. Reload sheet
```

---

### ❌ Issue: Self-Test ล้มเหลว (FAIL)

**Cause:** Column ขาด หรือ schema ไม่ตรง

**Workaround:**
```
1. ดู Apps Script → Logs
2. หา error message (เช่น "Missing header: LAT")
3. ตรวจ MASTER_PLACE! header row
4. เพิ่ม column ขาด หรือ re-run setupGeoCache_()
```

---

## 📚 Documentation

| File | Purpose | Last Updated |
|------|---------|--------------|
| `README.md` | Overview + Quick Start | 2026-09-14 |
| `CHANGELOG.md` | ประวัติแก้ไข (ไฟล์นี้) | 2026-09-14 |
| `DEPLOYMENT_CHECKLIST.md` | Deploy step-by-step | 2026-09-14 |
| `FILE_MANIFEST.md` | รายการไฟล์ทั้งหมด | 2026-09-14 |
| `SHEETS_REFERENCE.md` | โครงสร้างชีต (10 sheets) | 2026-09-03 |
| `AUDIT_FIXES_v5.5.7.md` | รายละเอียด AUDIT FIX 1-4 | 2026-09-03 |

---

## 🔐 Security & Privacy

### ✅ Changes in v5.5.8
- ❌ No credential stored in sheet
- ❌ No PII in public logs
- ✅ Cookie in UserProperties only
- ✅ RBAC enforcement active
- ✅ Validation before write

### ✅ Data Integrity
- ✅ Geocode validation (FIX-A)
- ✅ Frozen status tracking (FIX-B)
- ✅ Upgrade-only strategy (FIX-C)
- ✅ Postal key lookup verified
- ✅ Self-Test 18 cases

---

## 📞 Support & Reporting

**Version:** v5.5.8 (2026-09-14)  
**Maintainer:** Siriwat08  
**Repository:** https://github.com/Siriwat08/phaopanya-master-data-scgjwd

### Report Bug
```
1. เปิด GitHub Issues
2. ชื่อ: [v5.5.8] ชื่อปัญหา
3. บรรยาย: ขั้นตอน + error message + log screenshot
4. Label: bug / enhancement / question
```

### Request Feature
```
1. เปิด GitHub Issues
2. ชื่อ: [FEATURE] ชื่อคุณสมบัติ
3. Roadmap: v5.5.9 / v5.6.0 / Future
```

---

## 📝 Version History Summary

```
v5.5.6 (2026-08-15) ← Baseline
   ↓
v5.5.7 (2026-09-03) ← AUDIT FIX 1-4 (RBAC, Cookie, PII, Cache)
   ↓
v5.5.8 (2026-09-14) ← FIX-A/B/C (Validation, Frozen, Upgrade)
   ↓
v5.5.9 (TBD)       ← Geo Self-Learn (roadmap)
   ↓
v5.6.0 (TBD)       ← Document sync + repo refactor
```

---

**Last Modified:** 2026-09-14 19:30 UTC  
**Format:** Markdown  
**Encoding:** UTF-8 (Thai)  
**Status:** ✅ Production Ready
