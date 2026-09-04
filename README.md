# Phaopanya Master Data

> **เวอร์ชัน:** v5.5.6 (baseline ปัจจุบันในแพ็กเกจนี้)
> **รวม:** Maps service + Geo PATCH-4/5/6
> **สถานะ:** โค้ดกับเอกสารในโฟลเดอร์นี้ซิงค์กันแล้ว (2026-09-03)
> **Production-ready:** ยังต้องรัน Self-Test + smoke บน Sheet จริงก่อนใช้งานหนัก

## ความจริงของระบบ (ตรงโค้ด)

| หัวข้อ | ความจริงในโค้ด |
|--------|----------------|
| ไฟล์ `.gs` | **10 ไฟล์** (รวม `06_GoogleMapsService.gs` + `Service_SCG.gs`) |
| Geo index | CacheService + memory rebuild เมื่อ cache ใส่ไม่ได้ / หมดอายุ |
| Key match | `normSearchKey_` / `normPostalKey_` + `\|` + M-1 array + `pickRowByPostal_` |
| ปุ่ม 3 / 3b | เติม 7 คอลัมน์ U–AA บน `MASTER_PLACE` |
| PATCH-4 | `CHECK_NOTE` + รหัสในข้อความตรง dict → `CN_ZIP_OK` / `CN_ZIP_OK_EN` |
| PATCH-5 | `uiClearGeoColumnsOnly` — ล้างเฉพาะ U–AA |
| PATCH-6 | **Upgrade-only** สำหรับ `Reversegeocode` (Y): EN สะอาด = แช่แข็ง; ขยะ+มี EN ใน SOURCE = อัปเกรด |
| เมนูผล 3/3b | แสดง `yFrozen` / `yUpgraded` |
| Reset All | ล้าง SOURCE helper + MASTER + IDX + DAILY |
| RBAC | `ROLE_MAP` ว่าง = ใช้ได้; เมื่อใส่ email แล้ว → ไม่มี email = DENY |
| Cookie SCG | UserProperties + migrate/ล้างจากเซลล์ |
| Maps main path | `reverseGeocodeCached` = EN + strip Thai (เขียนลงชีตงาน) |
| Maps สูตรเซลล์ | `GOOGLEMAPS_*` บางตัว = ภาษาไทย (ตาม v5.5.3 split) |

## ไฟล์โค้ด (10)

| ไฟล์ | หน้าที่ |
|------|--------|
| `00_Config.gs` | ค่าคงที่ / ชื่อชีต / index / RBAC |
| `00_CleanService.gs` | ทำความสะอาดข้อความ / makeKey |
| `01_MasterService.gs` | ปุ่ม 1 สะสม MASTER |
| `02_WorkloadService.gs` | ปุ่ม 2 แมชต์งานวันนี้ |
| `03_Menu.gs` | เมนู + UI ปุ่ม |
| `04_GeoService.gs` | ปุ่ม 3 / 3b Geo + PATCH-4/5/6 |
| `05_SetupService.gs` | ตรวจโครงสร้าง |
| `06_GoogleMapsService.gs` | AppSheet bot + GOOGLEMAPS_* + maps menu |
| `Service_SCG.gs` | โหลด SCG API |
| `99_SelfTest.gs` | Self-Test |

## Deploy สั้น ๆ

1. Backup สคริปต์เดิม → วางทับ **10 ไฟล์** `.gs`
2. Reload ชีต → ตรวจเมนู `🚚 SCG/JWD Master` และเมนู Maps
3. 🧪 Self-Test → บันทึก PASS/FAIL
4. 🔑 Set SCG Cookie (ถ้าใช้โหลด API)
5. ลำดับปุ่มแนะนำ: 0 → 1 → 3 หรือ 3b → 2

รายละเอียด: `DEPLOYMENT_CHECKLIST.md` · `INSTALL_THIS_PACKAGE.txt` · `CHANGELOG.md`
