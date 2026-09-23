# CLEANUP_EXECUTION_PLAN.md

**โครงการ:** Phaopanya MASTER_PLACE Cleanup\
**ชุดข้อมูลอ้างอิง:** `Phaopanya_GAS_Cleanup_Suite_2026-09-23.zip`\
**Baseline:** `Code_Sheet` + `Phaopanya_Master_Data_23_09_2026.xlsx` วันที่
23/09/2026\
**Cleanup Suite:** GAS `50_CleanupConfig.gs` -- `58_CleanupMenu.gs`\
**Version เป้าหมาย:** `v5.6.0-task45`\
**สถานะก่อนเริ่ม:** READY FOR CONTROLLED CLEANUP --- ยังไม่อนุญาตให้ Apply กับ
Production

------------------------------------------------------------------------

## 0. หลักการควบคุมที่ต้องยึดตลอดงาน

### 0.1 เป้าหมาย

Cleanup ครั้งนี้มีเป้าหมายเพื่อแก้ **ข้อมูลที่มีหลักฐานเพียงพอ** โดยไม่ทำลาย identity,
provenance, operational data และข้อมูลต้นฉบับ

ลำดับความสำคัญ:

1.  Preserve baseline
2.  Evidence before change
3.  Dry-run before Apply
4.  Change only approved columns/rows
5.  Audit every material change
6.  Verify after every phase
7.  Rollback when acceptance criteria fail
8.  Never use AI/heuristic inference as an unqualified source of truth

### 0.2 Production ต้องไม่ถูกใช้เป็นสนามทดลอง

ให้แยก:

``` text
PRODUCTION
   │
   └── Baseline / untouched
            │
            ▼
CONTROLLED CLEANUP COPY
            │
            ▼
Dry-run → Apply → Verify
            │
            ▼
Promote only after acceptance
```

ห้ามนำผลจาก Dry-run ไปวางกลับ Production ด้วยมือ

### 0.3 ห้ามแก้ Identity

ตลอด Cleanup:

-   `MD_ID` = ห้ามเปลี่ยน
-   `MATCH_KEY` = เปลี่ยนได้เฉพาะ Phase 1 ตามผล normalization และต้องตรวจ
    duplicate ก่อน Apply
-   ห้ามสร้าง MD_ID ใหม่
-   ห้ามเปลี่ยน MD_ID เพื่อแก้ duplicate
-   ห้ามลบ Master row โดยอัตโนมัติ ยกเว้น Phase 1c ที่ผู้ปฏิบัติงานยืนยัน `CONFIRM=Y`
    ตามรายงาน `P1_DUP`

### 0.4 ห้ามแตะ provenance ที่สำคัญ

โดย Cleanup ปกติห้ามแก้:

-   `RAW_NAMES`
-   `RAW_ADDRS`
-   `FIRST_SEEN`
-   `LAST_SEEN`
-   `FIRST_LAT`
-   `FIRST_LNG`
-   `UPDATED_AT`
-   `POINTS`
-   `STATUS`

Phase 2 ออกแบบให้แก้ `U/V/W/X/AA` แต่ **Y = Reversegeocode ต้องคงเดิม**
เพราะเป็นหลักฐานฝั่ง source/geo text

### 0.5 ห้าม rerun Geo ทั้งชีตเพื่อหวังให้ข้อมูล "หายผิด"

โดยเฉพาะปุ่มเดิม:

-   `3) เติม 7 คอลัมน์ราชการ (Geo)`
-   `3b) เติม 7 คอลัมน์ราชการ (English)`
-   `1+3) ...`

ห้ามใช้เพื่อแทน Cleanup Phase 2/3

เหตุผล: Cleanup ต้องควบคุม scope และเก็บหลักฐานการเปลี่ยนแปลงเป็นราย Phase

------------------------------------------------------------------------

# Step 00 --- Backup + Freeze Baseline

## วัตถุประสงค์

สร้างจุดย้อนกลับก่อนแก้ข้อมูลแม้แต่ 1 cell

## ต้อง Backup อะไร

### A. Backup ทั้ง Spreadsheet ไป Google Drive

ใช้:

`CLEANUP MASTER → สำรองทั้งไฟล์ไป Drive`

ฟังก์ชัน:

`uiCleanupBackupDrive()` → `clBackupWholeFile_()`

ผลลัพธ์เป็น copy ทั้งไฟล์ รวมทุกชีตและสูตร

**ต้องเก็บ URL ของ backup**

ชื่อจะประมาณ:

``` text
BACKUP_MasterPlace_20260923_HHmm
```

### B. Backup MASTER เป็นแท็บ

รัน:

`CLEANUP MASTER → 0. ตรวจสถานะ + สำรอง`

ฟังก์ชัน:

`cleanupPhase0(true)` → `clBackupMasterTab_()`

สร้าง:

``` text
BK_MASTER_YYYYMMDD_HHMMSS
```

### C. Baseline metrics

Phase 0 ต้องสร้าง:

-   `CLEANUP_STATUS`
-   `CLEANUP_LOG`
-   `BK_MASTER_*`

และเก็บ baseline อย่างน้อย:

``` text
row count
MD_ID unique
MATCH_KEY duplicate count
STATUS distribution
N empty
O empty
U empty
V empty
W empty
X empty
Y empty
AA empty
O != W
N != V
PII counts
truncated address
MANUAL
high GEO_LAYER
```

## Baseline ที่คาดจาก snapshot ล่าสุด

``` text
MASTER rows            = 11,961
MD_ID duplicates       = 0
MATCH_KEY duplicates   = 0
O != W                 = 383
N != V                 = 40
O empty                = 1,702
U postal               = 5-digit values
LAT/LNG                = in expected Thailand range
```

หมายเหตุ: ไฟล์ Excel ใน ZIP มีคอลัมน์/หัวทดสอบท้ายชีตเพิ่มเติมจาก schema จริง ดังนั้น
**ก่อนลบให้ตรวจ header บน Google Sheet ตัวจริงอีกครั้ง**

## ก่อนเริ่ม: ลบ Test Columns

ใน snapshot Excel พบ artifact ท้าย `MASTER_PLACE`:

-   `AB = าา`
-   `AC = สูตรตรวจ O != W`
-   `AD = กด`
-   มี blank/dimension artifact ต่อท้ายใน Excel

หลักปฏิบัติ:

1.  ตรวจว่า AB:AD เป็น test artifact จริง
2.  บันทึกผลตรวจ AC ไว้ใน baseline/report
3.  ลบเฉพาะ test columns ที่ยืนยันแล้วว่าไม่ใช่ production schema
4.  **ห้ามลบ `Calculatedistances` หรือ `GEO_LAYER`**
5.  ห้ามใช้ตำแหน่งคอลัมน์เป็นหลักใน Cleanup; ให้ใช้ header name

## Acceptance Criteria --- Step 00

ต้อง PASS ทุกข้อ:

``` text
[PASS] Full spreadsheet backup URL ถูกเก็บ
[PASS] BK_MASTER_* ถูกสร้าง
[PASS] row count = 11,961
[PASS] MD_ID duplicate = 0
[PASS] MATCH_KEY duplicate = 0
[PASS] baseline metrics ถูกบันทึก
[PASS] Production ยังไม่มี data mutation จาก Cleanup
```

ถ้าข้อใด FAIL:

> **STOP --- ห้ามไป Step 01**

------------------------------------------------------------------------

# Step 01 --- Prepare Code_Sheet

## เป้าหมาย

แก้เฉพาะจุดที่จำเป็นต่อ Cleanup และ Patch

ห้าม refactor ระบบหลักในช่วงนี้

------------------------------------------------------------------------

## 01.1 `00_CleanService.gs`

### ฟังก์ชันที่ต้องแก้

`cleanThaiDigits_(s)`\
`cleanThai(s)`

ใช้ Patch:

`GAS_patches/00_CleanService_prefix_phone_patch.gs`

### วิธี

**Replace function เดิม** ด้วย implementation จาก patch

ห้ามเพิ่ม function ชื่อเดียวกันซ้ำ

### ต้องตรวจ

``` text
cleanThai('เขตเขตคลองเตย แขวงแขวงบางจาก')
→ เขตคลองเตย แขวงบางจาก

cleanThai('คุณ สมชาย 089-123-4567')
→ สมชาย

cleanThai('บริษัท เอบีซี 2250930775')
→ บริษัท เอบีซี

cleanThai('110/2 หมู่ 8 ซ สยามพัฒนา 7')
→ ไม่ถูกตัด
```

### ห้าม

-   เปลี่ยน `makeKey()`
-   เปลี่ยน `makeKeyAlias()`
-   เปลี่ยน normalization อื่นนอก scope
-   แก้ MATCH_KEY ใน Master ด้วยมือ

------------------------------------------------------------------------

## 01.2 `00_Config.gs`

ใช้ Patch:

`00_Config_SCRIPT_VERSION_patch.gs`

เพิ่ม/แทน single source of truth:

``` javascript
const SCRIPT_VERSION = 'v5.6.0-task45';
```

ต้องมี:

``` text
getScriptVersion_()
stampScriptVersion()
```

### สำคัญ

ห้ามสร้าง `SCRIPT_VERSION` ซ้ำในอีกไฟล์

หลังวาง patch ให้ค้นทั้ง project ด้วยคำว่า:

``` text
SCRIPT_VERSION
```

และต้องไม่มี declaration ซ้ำ

------------------------------------------------------------------------

## 01.3 `04_GeoService.gs`

ใช้:

`GAS_patches/04_GeoService_FIX_A_1hit_dedup_patch.gs`

### จุดแก้

ใน:

`geoExtractEn_(text)`

บริเวณประมาณบรรทัด 715--737 ของ snapshot

ต้องแทนเฉพาะ block ที่ใช้ English 1-hit matching

### ห้าม

-   rewrite `geoExtractEn_()` ทั้ง function
-   rerun Geo ทั้ง MASTER เพื่อ "apply patch"
-   เปลี่ยน `Y` ของข้อมูลเดิมโดยไม่มี Phase/หลักฐาน

Patch นี้มีผลกับ logic ในอนาคตและ Geo processing ที่เรียกใช้ function นี้

------------------------------------------------------------------------

## 01.4 `99_SelfTest.gs`

ใช้:

`GAS_patches/99_SelfTest_postal_lang_patch.gs`

ต้องทำ 3 ส่วน:

1.  เพิ่ม `pickGeoMatcher_(geoText)`
2.  เพิ่ม `testPostalFormat_()`
3.  เพิ่ม `testPostalFormat_` ในรายการ `tests`

และแก้:

``` text
geoMatch_(geoText)
```

ให้ใช้:

``` text
pickGeoMatcher_(geoText)(geoText)
```

### ผลที่ต้องได้

Self-Test จากเดิม 8 tests จะเป็น 9 tests

------------------------------------------------------------------------

## 01.5 `03_Menu.gs`

เพิ่ม **เพียง 1 บรรทัด** ใน `onOpen()` เดิม:

``` javascript
try { addCleanupMenu_(); } catch (e) { Logger.log(e); }
```

### ห้าม

-   สร้าง `onOpen()` ใหม่
-   ลบเมนูเดิม
-   เปลี่ยน menu ของ Daily
-   เปลี่ยน menu ของ SCG

------------------------------------------------------------------------

## 01.6 Files ใหม่ใน GAS

เพิ่มตามลำดับ:

``` text
50_CleanupConfig.gs
51_CleanupLib.gs
52_CleanupPhase0.gs
53_CleanupPhase1.gs
54_CleanupPhase2.gs
55_CleanupPhase3.gs
56_CleanupPhase4.gs
57_CleanupPhase5.gs
58_CleanupMenu.gs
```

และเพิ่ม Audit layer ตาม Step 01.7 ด้านล่างก่อน Apply จริง

------------------------------------------------------------------------

## 01.7 เพิ่ม `CLEANUP_AUDIT` ก่อน Apply จริง

### เหตุผลสำคัญ

Cleanup Suite ปัจจุบันมี `CLEANUP_LOG` ซึ่งเป็น **run-level log**:

``` text
เวลา
เฟส
สถานะ
รายละเอียด
```

แต่ยังไม่มี **row-level change audit** ตามมาตรฐานที่ต้องการ

ดังนั้นก่อน Apply Phase 1--3 ต้องเพิ่ม:

``` text
CLEANUP_AUDIT
```

### Schema บังคับ

``` text
RUN_ID
TIMESTAMP
PHASE
MD_ID
FIELD
OLD_VALUE
NEW_VALUE
REASON
EVIDENCE
CONFIDENCE
ACTION
OPERATOR
ROLLBACK_STATUS
```

### ตัวอย่าง

``` text
RUN_ID: CLN-20260923-001
TIMESTAMP: 2026-09-23T20:15:00+07:00
PHASE: 2
MD_ID: MD-001234
FIELD: AMPHOE
OLD_VALUE: บางบัวทอง
NEW_VALUE: ปากเกร็ด
REASON: KNN
EVIDENCE: 8/10 neighbors support target
CONFIDENCE: HIGH
ACTION: AUTO_FIX
OPERATOR: <actual operator>
ROLLBACK_STATUS: PENDING
```

### กฎ Audit

ทุกการเปลี่ยนแปลงที่เขียนจริงต้องมี audit row

ถ้า Apply เปลี่ยน:

``` text
U
V
W
X
AA
```

ต้องบันทึกแต่ละ field หรือใช้ row-level record ที่ระบุ fields ทั้งหมดอย่างชัดเจน

### สำคัญ

`CLEANUP_LOG` และ `CLEANUP_AUDIT` ไม่ใช่สิ่งเดียวกัน

``` text
CLEANUP_LOG
= "Phase 2 ทำอะไรและผลรวมเท่าไร"

CLEANUP_AUDIT
= "MD_ID ไหน field ไหน เปลี่ยนจากอะไรเป็นอะไร เพราะอะไร"
```

------------------------------------------------------------------------

# Step 02 --- Install + Validate Patches

## ลำดับ

1.  Replace `cleanThai`
2.  Patch `00_Config`
3.  Patch `04_GeoService`
4.  Patch `99_SelfTest`
5.  Add `addCleanupMenu_()` เข้า `03_Menu.gs`
6.  เพิ่ม Cleanup 50--58
7.  เพิ่ม Audit layer
8.  Save ทุกไฟล์
9.  รัน `stampScriptVersion()`
10. Refresh Spreadsheet

## ตรวจ function duplicate

ค้นชื่อ:

``` text
cleanThai
SCRIPT_VERSION
onOpen
```

ต้องไม่มี duplicate declaration ที่เกิดจากการ paste patch ซ้ำ

## Acceptance Criteria

``` text
[PASS] 50–58 compile ได้
[PASS] cleanThai patch active
[PASS] SCRIPT_VERSION = v5.6.0-task45
[PASS] FIX-A active
[PASS] SelfTest Test 9 registered
[PASS] CLEANUP MASTER menu ปรากฏ
[PASS] CLEANUP_AUDIT พร้อมใช้งาน
```

ถ้า compile error หรือ duplicate function:

> STOP --- ยังไม่ให้ Cleanup ทำจริง

------------------------------------------------------------------------

# Step 03 --- Self-Test

รัน:

`🚚 SCG/JWD Master → ดูผล / รีเซ็ต → Self-Test`

## Test ที่ต้องมี 9 รายการ

1.  `testKeyAlignment_`
2.  `testCacheState_`
3.  `testMasterIdUniqueness_`
4.  `testHelperSchema_`
5.  `testPostalCoverage_`
6.  `testLatLongRange_`
7.  `testPiiColumns_`
8.  `testRbacConfig_`
9.  `testPostalFormat_`

## Acceptance Criteria

### Critical tests ต้อง PASS

``` text
testKeyAlignment_       PASS
testMasterIdUniqueness_ PASS
testHelperSchema_       PASS
testPostalFormat_       PASS
testLatLongRange_       PASS
```

### `testPostalCoverage_`

ต้องไม่ FAIL เพราะ language-path false negative เดิม

### `WARN`

ยอมรับได้เฉพาะถ้าเป็น known condition:

``` text
Cache cold-start
PII governance warning
RBAC not configured
```

แต่ต้องบันทึกไว้

### ห้าม

-   แก้ข้อมูลเพื่อทำให้ Self-Test เขียว
-   rerun Geo ทั้งชีตเพื่อแก้ Self-Test
-   ลบ warning โดยแก้ข้อความ test

ถ้า critical test FAIL:

> **STOP**

------------------------------------------------------------------------

# Step 04 --- Phase 0: Preflight + Backup

รัน:

`CLEANUP MASTER → 0. ตรวจสถานะ + สำรอง`

## ต้องตรวจ

### Identity

``` text
rows = 11,961
MD_ID duplicate = 0
MATCH_KEY duplicate = 0
```

### Geo

``` text
O != W = 383
N != V = 40
O empty = 1,702
```

### Data quality

``` text
PII
duplicate prefix
truncated address
MANUAL
GEO_LAYER
empty geo columns
```

## Output

``` text
CLEANUP_STATUS
CLEANUP_LOG
BK_MASTER_*
```

## Acceptance Criteria

Baseline ต้องถูกบันทึกครบ และตัวเลขต้องไม่เบี่ยงอย่างไม่มีเหตุผลจาก snapshot

### ตัวอย่าง acceptance

``` text
BEFORE
Rows = 11,961
MD_ID dup = 0
MATCH_KEY dup = 0
O != W = 383
O empty = 1,702
```

ถ้า row count เปลี่ยนก่อน Cleanup:

> STOP และตรวจว่าใคร/อะไรแก้ข้อมูลก่อนเริ่มงาน

------------------------------------------------------------------------

# Step 05 --- Phase 1: Prefix + PII

ไฟล์:

`53_CleanupPhase1.gs`

ฟังก์ชัน:

`cleanupPhase1(false)` = Dry-run\
`cleanupPhase1(true)` = Apply

## Dry-run ก่อน

ตรวจ:

``` text
P1_REVIEW
P1_DUP
```

## คอลัมน์ที่ Phase 1 อนุญาตให้เปลี่ยน

``` text
NAME_CLEAN
ADDR_CLEAN
OWNER_CLEAN
MATCH_KEY
PHONE_EXTRACTED
CLEANUP_DATE
```

## คอลัมน์ที่ห้ามเปลี่ยน

``` text
MD_ID
POINTS
FIRST_SEEN
LAST_SEEN
STATUS
RAW_NAMES
RAW_ADDRS
LAT
LNG
FIRST_LAT
FIRST_LNG
PROVINCE
AMPHOE
CONFIRMED_BY
REVIEW_NOTE
Rahatpraisanee
Changwat
Amphoe_Khet
Tambon_Kwaeng
Reversegeocode
Calculatedistances
GEO_LAYER
UPDATED_AT
```

## Expected snapshot

``` text
NAME changed       ≈ 957
ADDR changed       ≈ 6,459
OWNER changed      ≈ 0
MATCH_KEY changed  ≈ 6,708
PII rows           ≈ 973
```

ตัวเลขจริงต้องยึด Dry-run ปัจจุบัน ไม่ยึดตัวเลขเก่าแบบตายตัว

## กฎ MATCH_KEY

ถ้า:

``` text
newDup > oldDup
```

ให้สร้าง:

``` text
P1_DUP
```

และ **ห้าม merge อัตโนมัติ**

## Acceptance Criteria

``` text
BEFORE
rows = 11,961
MD_ID unique = 11,961
MATCH_KEY duplicate = 0

AFTER DRY-RUN
new MATCH_KEY duplicate groups = known/approved only
no MD_ID mutation
no protected field mutation
```

ถ้า `newDup > oldDup`:

> STOP Phase 1 Apply และตรวจ `P1_DUP`

------------------------------------------------------------------------

# Step 05b --- Phase 1c Merge Duplicates

ใช้เฉพาะกลุ่มที่ตรวจแล้วและผู้ปฏิบัติงานใส่:

``` text
CONFIRM = Y
```

ใน `P1_DUP`

## ห้าม

-   กดรวมทุกกลุ่มโดยไม่ตรวจ
-   เลือก KEEP_MD_ID ด้วย random order
-   เปลี่ยน MD_ID
-   merge กลุ่มที่ยังไม่เข้าใจ provenance

## Acceptance

ทุก merge ต้องมี Audit:

``` text
ACTION = MERGE
KEEP_MD_ID
DELETE_MD_ID
REASON
EVIDENCE
```

และต้องมี backup ก่อน merge

------------------------------------------------------------------------

# Step 06 --- Phase 2: Resolve O != W

ไฟล์:

`54_CleanupPhase2.gs`

ฟังก์ชัน:

`cleanupPhase2(false)`\
`cleanupPhase2(true)`

## Baseline

``` text
O != W = 383
```

## Decision classes

### A. TH-side right

``` text
O matches pin
```

เป็น candidate สำหรับแก้:

``` text
U
V
W
X
AA
```

### B. EN-side right

``` text
W matches pin
```

**ห้ามแก้ Master ใน Phase 2**

ส่งเข้า:

``` text
P2_DOCSIDE
```

เพื่อแก้ที่ Source/SCG

### C. undecided/border

ส่ง:

``` text
P2_UNDECIDED
```

ไม่ auto-fix

------------------------------------------------------------------------

## Auto-Fix criteria

ปัจจุบัน code ใช้:

``` text
k = 15
MIN_VOTES = 3
```

และต้องมี verdict:

``` text
TH-side right (O matches pin)
```

จากนั้น:

``` text
V_new = N ถ้า N มีค่า ไม่เช่นนั้น V เดิม
W_new = normalized O
X_new = majority ของเพื่อนบ้านที่ W ตรง O
U_new = majority หรือ SYS_TH_GEO fallback
AA_new = KNN_FIX
```

### X

ถ้า votes \< 3:

``` text
X_KEEP_REVIEW
```

ไม่ auto-fix

### U

ถ้า votes \< 3:

-   ใช้ `SYS_TH_GEO` fallback ถ้ามีคู่ Amphoe/Tambon
-   ถ้าไม่มี → `U_KEEP_REVIEW`

------------------------------------------------------------------------

## Phase 2 Auto-Fix ห้ามทำถ้า

``` text
verdict != TH-side right
X votes < 3
U ไม่มี evidence และไม่มี dictionary fallback
สูตรอยู่ใน target columns
MD_ID ไม่ตรง
row alignment ผิด
```

------------------------------------------------------------------------

## Acceptance Criteria --- Phase 2

### รอบแรก

``` text
BEFORE
O != W = 383

DRY-RUN
TH-side right = candidate
EN-side right = docside
undecided = review
```

ตัวเลขอ้างอิงเดิม:

``` text
106 candidate
269 docside
8 undecided
```

แต่ต้องยึดผล Dry-run ปัจจุบันเป็น authoritative

### หลัง Apply

ต้องบันทึก:

``` text
Auto-fixed = ?
Skipped flagged = ?
Docside = ?
Undecided = ?
Remaining O != W = ?
```

### PASS CONDITION

``` text
MD_ID unchanged
row count = 11,961
MATCH_KEY unchanged by Phase 2
RAW fields unchanged
Y unchanged
UPDATED_AT unchanged
Only U/V/W/X/AA approved rows changed
Every changed field has CLEANUP_AUDIT
```

------------------------------------------------------------------------

# Step 07 --- Repeat Phase 2

นี่เป็น **ข้อบังคับ** ไม่ใช่ optional

เหตุผล:

หลังแก้ 106 แถวแรก voter pool เปลี่ยน

จึงอาจทำให้ candidate ใหม่ปรากฏ

จากการทดสอบในชุดนี้พบตัวอย่าง:

``` text
Round 1 = 106
Round 2 = +4
Round 3 = +1
รวม = 111
```

แต่ตัวเลขจริงต้องคำนวณใหม่

## Loop

``` text
DRY RUN
   ↓
ถ้ามี fix candidate
   ↓
ตรวจ P2_FIX
   ↓
APPLY
   ↓
VERIFY
   ↓
DRY RUN ใหม่
```

## หยุดเมื่อ

``` text
new TH-side-right auto-fix candidate = 0
```

และ:

``` text
remaining O != W
= docside + undecided + cases ที่ต้อง Source correction
```

ไม่ใช่จำเป็นต้องเป็น 0 ทั้งหมด

### สำคัญ

`O != W = 0` ไม่ใช่ PASS CONDITION

เพราะ 269 อาจเป็น **Source-side problem** และ 8 เป็น **uncertain**

------------------------------------------------------------------------

# Step 08 --- Phase 3: Fill Empty PROVINCE/AMPHOE

ไฟล์:

`55_CleanupPhase3.gs`

ฟังก์ชัน:

`cleanupPhase3(false)`\
`cleanupPhase3(true)`

## Baseline

``` text
O empty = 1,702
```

## Auto-fill

ใช้เฉพาะ:

``` text
W != ''
V != ''
W votes >= 3
last neighbor <= 5 km
reason = CONSISTENT
```

ค่าที่เติม:

``` text
N ← V
O ← W
```

## Expected snapshot

``` text
1,702 empty
├── 1,637 CONSISTENT → Auto-fill
└── 65 REVIEW
    ├── 39 FAR_NEIGHBORS_GT5KM
    ├── 15 WEAK_VOTES
    └── 11 INCONSISTENT_0_VOTES
```

ตัวเลขนี้เป็น expected snapshot ไม่ใช่ hard-coded acceptance target

## 65 Review

**ห้าม Auto-fix**

ต้องเก็บ:

``` text
P3_REVIEW
```

และค่อยตัดสินด้วยหลักฐานเพิ่มเติม

------------------------------------------------------------------------

## Acceptance Criteria --- Phase 3

### BEFORE

``` text
O empty = 1,702
```

### AFTER

``` text
Auto-filled = ?
Review = ?
Remaining O empty = ?
```

### PASS CONDITION

``` text
rows = 11,961
MD_ID unchanged
RAW unchanged
V/W/X unchanged
UPDATED_AT unchanged
Only N/O changed
Only CONSISTENT rows changed
Every changed N/O has CLEANUP_AUDIT
```

ถ้า script เขียน N/O นอก `CONSISTENT`:

> FAIL → ROLLBACK

------------------------------------------------------------------------

# Step 09 --- Phase 4--5

# Phase 4 --- Source Correction Package

ไฟล์:

`56_CleanupPhase4.gs`

Phase 4 **ไม่แก้ MASTER**

สร้าง:

``` text
P4_อ่านก่อน
P4_ที่อยู่พิมพ์ผิด
P4_ตัดกลางคัน
P4_สรุปPII
```

## สิ่งที่ส่งกลับ Source/SCG

### 1. 269 doc-side cases

ใช้:

`P4_ที่อยู่พิมพ์ผิด`

### 2. Truncated address

ใช้:

`P4_ตัดกลางคัน`

expected snapshot:

``` text
22 rows
```

### 3. PII

ใช้:

`P4_สรุปPII`

### หลักการ

ถ้าเป็น source problem:

``` text
อย่าแก้ MASTER เพื่อกลบ source error
```

ให้แก้ Source ก่อน แล้วปล่อย pipeline ปกติ rebuild/merge ตาม architecture

------------------------------------------------------------------------

# Phase 5 --- Export / Evidence Package

ไฟล์:

`57_CleanupPhase5.gs`

มี 3 mode:

### A. Rows --- แนะนำ

`cleanupPhase5Rows()`

ส่งออกเฉพาะ problem rows

เหมาะสำหรับ:

-   review
-   ส่ง SCG
-   audit

### B. Cols

`cleanupPhase5Cols()`

สร้าง export ที่ตัด:

``` text
RAW_NAMES
RAW_ADDRS
```

**ห้ามใช้เป็น production replacement**

เป็น export เท่านั้น

### C. ZIP

`cleanupPhase5Zip()`

รวม report tabs

## Acceptance

ไฟล์ export ต้อง:

``` text
เปิดได้
UTF-8/Thai ไม่เสีย
row count ตรง
MD_ID ไม่หาย
ไม่ใช่ replacement ของ MASTER
```

------------------------------------------------------------------------

# Step 10 --- Final Verification

หลัง Phase 1--5 จบ ต้องทำ Final Verification แบบ independent จากรายงานแต่ละ
Phase

## 10.1 Identity

``` text
row count = 11,961
MD_ID nonblank = 11,961
MD_ID unique = 11,961
```

ถ้า row count เปลี่ยน:

> ตรวจ merge/deletion ก่อนถือว่า PASS

## 10.2 MATCH_KEY

ต้องบันทึก:

``` text
duplicate before
duplicate after
new duplicate groups
resolved groups
```

ถ้า duplicate ใหม่เกิดโดยไม่อยู่ใน approved merge plan:

> FAIL

## 10.3 Protected fields

เปรียบเทียบ baseline กับ final:

``` text
RAW_NAMES
RAW_ADDRS
FIRST_SEEN
LAST_SEEN
FIRST_LAT
FIRST_LNG
UPDATED_AT
POINTS
STATUS
```

ต้องไม่มี unintended changes

## 10.4 Geo

ตรวจ:

``` text
LAT range
LNG range
GEO_LAYER
Y
V/W/X
```

Phase 2/3 ต้องไม่ทำให้ GEO evidence เดิมหาย

## 10.5 Phase 2

รายงาน:

``` text
O != W before
TH-side-right fixed
EN-side-right source review
undecided
remaining O != W
```

## 10.6 Phase 3

รายงาน:

``` text
O empty before
auto-fill
manual review
O empty after
```

## 10.7 PII

ต้องตรวจว่า:

``` text
NAME_CLEAN
ADDR_CLEAN
OWNER_CLEAN
```

ไม่มี phone/loose-number ที่ควรถูกล้างตาม rule ใหม่

และต้องตรวจ `PHONE_EXTRACTED`

## 10.8 UPDATED_AT

ต้องเทียบ baseline:

``` text
UPDATED_AT changed by cleanup = 0
```

## 10.9 Audit completeness

สำหรับทุก row/field ที่เปลี่ยน:

``` text
CLEANUP_AUDIT exists = YES
OLD_VALUE present
NEW_VALUE present
REASON present
EVIDENCE present
CONFIDENCE present
ACTION present
```

------------------------------------------------------------------------

# Final Acceptance Criteria

ระบบถือว่า **CLEANUP ACCEPTED** เมื่อ:

``` text
[PASS] Backup exists
[PASS] Baseline preserved
[PASS] row count verified
[PASS] MD_ID uniqueness = 100%
[PASS] no unauthorized MD_ID changes
[PASS] MATCH_KEY duplicates = approved/known only
[PASS] protected fields unchanged
[PASS] UPDATED_AT unchanged
[PASS] Phase 1 changes audited
[PASS] Phase 2 changes audited
[PASS] Phase 3 changes audited
[PASS] unresolved cases separated for review/source
[PASS] P4 source package created
[PASS] final Self-Test completed
[PASS] no critical FAIL
[PASS] rollback point remains available
```

------------------------------------------------------------------------

# Step 11 --- Rollback

## Level 1 --- Rollback ก่อน Phase ถัดไป

ถ้า Phase ใด FAIL:

1.  หยุดทันที
2.  ห้าม run Phase ถัดไป
3.  เก็บ `CLEANUP_LOG`
4.  เก็บ `CLEANUP_AUDIT`
5.  เก็บ P\*\_REVIEW / P\*\_FIX
6.  เปรียบเทียบ baseline

## Level 2 --- Restore MASTER

ใช้:

`CLEANUP MASTER → กู้คืน MASTER จากแท็บสำรอง`

ฟังก์ชัน:

`uiCleanupRestore()`

ระบบจะ:

1.  แสดง `BK_MASTER_*`
2.  ให้เลือก backup
3.  backup สถานะปัจจุบันก่อน restore
4.  restore จาก backup

## Level 3 --- Full Spreadsheet Restore

ถ้าปัญหาไม่ได้อยู่เฉพาะ MASTER:

ใช้ Google Drive backup ของทั้ง Spreadsheet

``` text
BACKUP_MasterPlace_YYYYMMDD_HHmm
```

------------------------------------------------------------------------

# Rollback Acceptance

หลัง rollback ต้องตรวจ:

``` text
row count = baseline
MD_ID set = baseline
MATCH_KEY set = baseline
protected fields = baseline
UPDATED_AT = baseline
```

ถ้า rollback แล้วไม่ตรง baseline:

> **STOP --- ห้ามแก้ด้วยมือ ให้เก็บทั้งสองสถานะไว้เพื่อ forensic comparison**

------------------------------------------------------------------------

# Change Control Matrix

  --------------------------------------------------------------------------------------------
  Phase             Allowed change                Forbidden change           Main evidence
  ----------------- ----------------------------- -------------------------- -----------------
  0                 backup/report tabs            MASTER mutation            CLEANUP_STATUS

  1                 NAME/ADDR/OWNER/MATCH_KEY +   ID/provenance/UPDATED_AT   P1_REVIEW
                    audit cols                                               

  1c                approved duplicate merge      unapproved deletion        P1_DUP + Audit

  2                 U/V/W/X/AA approved rows      Y/RAW/UPDATED_AT           P2_FIX

  3                 N/O consistent rows           V/W/X/RAW/UPDATED_AT       P3_FILL

  4                 report tabs only              MASTER mutation            P4\_\*

  5                 export files only             production replacement     Drive export

  Final             reports/tests                 new data mutation          baseline
                                                                             comparison
  --------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# Operational Stop Conditions

ให้ถือว่าเป็น **HARD STOP** เมื่อพบข้อใดข้อหนึ่ง:

``` text
1. Backup ไม่สำเร็จ
2. row count เปลี่ยนก่อน Cleanup
3. MD_ID duplicate เพิ่ม
4. MD_ID ถูกเปลี่ยน
5. protected field เปลี่ยน
6. UPDATED_AT ถูกเปลี่ยน
7. Formula ถูกพบใน target column
8. Patch compile ไม่ผ่าน
9. duplicate function declaration
10. Phase Apply ไม่มี Audit
11. Dry-run กับ Apply ให้ผลต่างอย่างไม่มีคำอธิบาย
12. KNN verdict ไม่มี evidence แต่ script พยายาม auto-fix
13. Phase 2 candidate ไม่ลู่เข้า
14. Phase 3 แก้แถวที่ไม่ใช่ CONSISTENT
15. Rollback ไม่คืน baseline
```

------------------------------------------------------------------------

# RUN ID Standard

แนะนำให้ใช้:

``` text
CLN-YYYYMMDD-NNN
```

ตัวอย่าง:

``` text
CLN-20260923-001
```

แต่ละ Apply session ต้องมี RUN_ID เดียวกันตลอด phase นั้น

ตัวอย่าง:

``` text
CLN-20260923-001
 ├── PHASE 1
 ├── PHASE 2-R1
 ├── PHASE 2-R2
 ├── PHASE 2-R3
 └── PHASE 3
```

------------------------------------------------------------------------

# CLEANUP_AUDIT --- Standard Schema

``` text
RUN_ID
TIMESTAMP
PHASE
MD_ID
FIELD
OLD_VALUE
NEW_VALUE
REASON
EVIDENCE
CONFIDENCE
ACTION
OPERATOR
ROLLBACK_STATUS
```

## ค่า ACTION ที่แนะนำ

``` text
AUTO_FIX
MANUAL_FIX
MERGE
SOURCE_REVIEW
KEEP
ROLLBACK
```

## ค่า CONFIDENCE

``` text
HIGH
MEDIUM
LOW
```

### ห้าม

อย่าใช้:

``` text
AI_DECIDED
AI_THINKS
PROBABLY_WRONG
```

เพราะ Audit ต้องอธิบาย **evidence** ไม่ใช่ความรู้สึกของ model

------------------------------------------------------------------------

# Recommended Audit Examples

## Phase 1

``` text
RUN_ID: CLN-20260923-001
PHASE: 1
MD_ID: MD-001234
FIELD: NAME_CLEAN
OLD_VALUE: คุณ สมชาย 089-123-4567
NEW_VALUE: สมชาย
REASON: PHONE_NORMALIZATION
EVIDENCE: cleanThai patch rule
CONFIDENCE: HIGH
ACTION: AUTO_FIX
```

## Phase 2

``` text
RUN_ID: CLN-20260923-001
PHASE: 2
MD_ID: MD-001234
FIELD: AMPHOE
OLD_VALUE: บางบัวทอง
NEW_VALUE: ปากเกร็ด
REASON: KNN
EVIDENCE: O matches pin; 8/10 supporting neighbors; median distance documented in P2_FIX
CONFIDENCE: HIGH
ACTION: AUTO_FIX
```

## Phase 3

``` text
RUN_ID: CLN-20260923-001
PHASE: 3
MD_ID: MD-009999
FIELD: AMPHOE
OLD_VALUE:
NEW_VALUE: เมืองนนทบุรี
REASON: CONSISTENT_KNN
EVIDENCE: W=เมืองนนทบุรี; >=3/15 votes; neighbor distance <=5km
CONFIDENCE: HIGH
ACTION: AUTO_FIX
```

------------------------------------------------------------------------

# Final Operating Sequence --- ฉบับที่ต้องทำจริง

``` text
00  Freeze Production
 ↓
01  Full Spreadsheet Backup
 ↓
02  MASTER BK backup
 ↓
03  Record baseline
 ↓
04  Remove verified test columns only
 ↓
05  Patch Code_Sheet
 ↓
06  Install Cleanup 50–58
 ↓
07  Install CLEANUP_AUDIT
 ↓
08  stampScriptVersion()
 ↓
09  Refresh
 ↓
10  Self-Test
 ↓
11  Phase 0 dry/preflight + backup
 ↓
12  Phase 1 DRY
 ↓
13  Review P1_REVIEW / P1_DUP
 ↓
14  Phase 1 APPLY
 ↓
15  Verify + Audit
 ↓
16  Phase 1c merge only approved groups
 ↓
17  Verify
 ↓
18  Phase 2 DRY
 ↓
19  Review P2_FIX / P2_DOCSIDE / P2_UNDECIDED
 ↓
20  Phase 2 APPLY
 ↓
21  Verify
 ↓
22  Phase 2 DRY again
 ↓
23  Repeat until new auto-fix candidate = 0
 ↓
24  Phase 3 DRY
 ↓
25  Review P3_FILL / P3_REVIEW
 ↓
26  Phase 3 APPLY
 ↓
27  Verify
 ↓
28  Phase 4 Source package
 ↓
29  Phase 5 evidence export
 ↓
30  Final Self-Test
 ↓
31  Independent baseline comparison
 ↓
32  ACCEPT / ROLLBACK
 ↓
33  Promote to Production only if ACCEPT
```

------------------------------------------------------------------------

# สิ่งที่ "ห้ามทำ" ตลอดโครงการ

``` text
ห้าม 1: แก้ Production ก่อน Backup
ห้าม 2: Apply ก่อน Dry-run
ห้าม 3: เพิ่ม Patch ซ้ำแทนการ Replace
ห้าม 4: สร้าง onOpen ใหม่
ห้าม 5: เปลี่ยน MD_ID
ห้าม 6: ลบ RAW_NAMES / RAW_ADDRS ใน MASTER
ห้าม 7: เปลี่ยน UPDATED_AT
ห้าม 8: แก้ Y ด้วย Cleanup Phase 2
ห้าม 9: เอา W มาทับ O เพียงเพราะ W มีค่า
ห้าม 10: Auto-fix 8 undecided
ห้าม 11: Auto-fix 65 Phase-3 review
ห้าม 12: Merge P1_DUP โดยไม่ CONFIRM=Y
ห้าม 13: Rerun Geo ทั้งชีตเพื่อแก้ Cleanup
ห้าม 14: ใช้ Phase 5 export เป็น production replacement
ห้าม 15: ลบ Audit/Backup ก่อน Final Acceptance
```

------------------------------------------------------------------------

# Definition of Done

Cleanup รอบนี้ถือว่าเสร็จ **ไม่ใช่เมื่อ O != W กลายเป็น 0**

แต่ถือว่าเสร็จเมื่อ:

``` text
DATA
  ✓ known errors corrected
  ✓ uncertain cases isolated
  ✓ source errors separated from master errors

IDENTITY
  ✓ MD_ID preserved
  ✓ MATCH_KEY integrity verified

PROVENANCE
  ✓ RAW preserved
  ✓ GEO evidence preserved
  ✓ UPDATED_AT untouched

CONTROL
  ✓ every phase dry-run first
  ✓ every mutation audited
  ✓ rollback tested/available

OPERATIONS
  ✓ Daily operation unaffected
  ✓ Self-Test passed critical checks
  ✓ final baseline comparison passed

SOURCE
  ✓ SCG correction package produced

GOVERNANCE
  ✓ CLEANUP_AUDIT retained
  ✓ CLEANUP_LOG retained
  ✓ backup retained
```

**สถานะหลังทำตามแผน:** `CONTROLLED CLEANUP ACCEPTED`\
**ถ้าไม่ผ่านข้อใดข้อหนึ่ง:** `STOP / ROLLBACK / INVESTIGATE`

------------------------------------------------------------------------

## หมายเหตุจากการตรวจชุดข้อมูล 23/09/2026

เอกสารนี้ยึดโครงสร้างและโค้ดจริงใน ZIP ชุดล่าสุด โดยเฉพาะ:

-   `Code_Sheet/Code_Sheet/00_CleanService.gs`
-   `00_Config.gs`
-   `03_Menu.gs`
-   `04_GeoService.gs`
-   `99_SelfTest.gs`
-   `GAS/50–58_Cleanup*.gs`
-   `GAS_patches/*`
-   `Phaopanya_Master_Data_23_09_2026.xlsx`

จุดสำคัญที่เพิ่มจาก Cleanup Suite เดิมคือ **CLEANUP_AUDIT แบบ row/field-level**
เพราะ `CLEANUP_LOG` ปัจจุบันเป็น run-level log
และยังไม่เพียงพอสำหรับการพิสูจน์ว่าแต่ละ Master field เปลี่ยนจากอะไรเป็นอะไร
