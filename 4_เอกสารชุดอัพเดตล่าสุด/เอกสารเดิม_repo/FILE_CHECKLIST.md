# FILE_CHECKLIST — v5.5.6

รายการไฟล์ในแพ็กเกจนี้ต้องตรงกับโฟลเดอร์โค้ดจริง

## โค้ด (10)

| ไฟล์ | บทบาท |
|------|--------|
| 00_Config.gs | Config / ชีต / RBAC |
| 00_CleanService.gs | Normalize / makeKey |
| 01_MasterService.gs | ปุ่ม 1 |
| 02_WorkloadService.gs | ปุ่ม 2 |
| 03_Menu.gs | เมนู + แสดง yFrozen/yUpgraded |
| 04_GeoService.gs | ปุ่ม 3/3b + PATCH-4/5/6 |
| 05_SetupService.gs | ตรวจโครงสร้าง |
| 06_GoogleMapsService.gs | Maps + AppSheet + GOOGLEMAPS_* |
| Service_SCG.gs | โหลด SCG |
| 99_SelfTest.gs | Self-Test |

## เอกสาร

| ไฟล์ | บทบาท |
|------|--------|
| README.md | สรุปความจริงระบบ v5.5.6 |
| CHANGELOG.md | ประวัติ รวม [5.5.6] |
| INSTALL_THIS_PACKAGE.txt | วิธีวางไฟล์ |
| FILE_CHECKLIST.md | ไฟล์นี้ |
| CHECKLIST.md | จุดตรวจคุณภาพ |
| DEPLOYMENT_CHECKLIST.md | ขั้นตอน deploy |
| Blueprint.md | สถาปัตยกรรม |
| SHEETS_REFERENCE.md | คอลัมน์/ชีต |
| PENDING_FIXES.md | ค้างที่ยังไม่ทำในโค้ด |
| STABILITY_PLAN.md | แผนความนิ่ง |

## จุดที่โค้ดมีแล้ว (อย่าใส่เป็น “ค้างแก้” ในเอกสาร)

- PATCH-4 CN_ZIP_OK(_EN)
- PATCH-5 ล้าง U–AA
- PATCH-6 Upgrade-only Y + ตัวชี้วัดเมนู
- ไฟล์ Maps ในโปรเจกต์เดียวกัน (namespace MAPS_*)

## Verify หลังซิงค์เอกสาร

- [ ] README ระบุ 10 ไฟล์ และ v5.5.6
- [ ] CHANGELOG มีหัวข้อ [5.5.6] และไม่ขัดกับโค้ด
- [ ] INSTALL รายการไฟล์ครบ 10
- [ ] ไม่มีเอกสารหลักที่ยังบอกว่าเป็น v5.4.4 / 10 ไฟล์ เป็น baseline
