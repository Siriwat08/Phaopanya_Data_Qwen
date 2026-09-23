# PENDING_FIXES — สถานะเทียบโค้ด v5.5.6

อัปเดต: 2026-09-03 (ซิงค์เอกสารกับโค้ด — ไม่เพิ่มฟีเจอร์ใหม่)

## ทำแล้วในโค้ด (อย่าใส่ค้าง)

| รายการ | ที่อยู่ |
|--------|--------|
| CN_ZIP_OK / CN_ZIP_OK_EN | 04_GeoService (PATCH-4) |
| ล้างเฉพาะ U–AA | uiClearGeoColumnsOnly (PATCH-5) |
| Y แช่แข็ง / อัปเกรด (Upgrade-only) | buildSkippedGeoRow_ / geoIsCleanEnText_ (PATCH-6) |
| เมนูแสดง yFrozen / yUpgraded | 03_Menu |
| Maps ในโปรเจกต์เดียวกัน | 06_GoogleMapsService + mapsInstallMenu_ |
| Cookie → UserProperties | Service_SCG / เมนู Security |

## ค้างที่เอกสารเคยพูดถึง แต่ยังไม่ใช่ PATCH ในชุดนี้

| รายการ | หมายเหตุ |
|--------|----------|
| Runtime Self-Test บน Sheet จริง | ต้องรันใน environment ผู้ใช้ — เอกสารอย่างเดียวปิดไม่ได้ |
| คุณภาพ SOURCE ภาษาไทยเดือนเก่า | เป็นข้อมูล/workflow ไม่ใช่ bug โค้ด v5.5.6 |
| RBAC ROLE_MAP ว่าง | พฤติกรรมตามดีไซน์: ว่าง = ไม่ enforce |

## ไม่เพิ่มฟีเจอร์ใหม่ในรอบซิงค์เอกสารนี้
