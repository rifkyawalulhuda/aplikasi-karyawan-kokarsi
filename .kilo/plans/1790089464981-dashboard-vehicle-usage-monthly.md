# Plan: Change "Pemakaian per Kendaraan" to Monthly (Current Month WIB)

## Goal
Change the "Pemakaian per Kendaraan" section in Dashboard from showing **all-time totals** to showing **current month totals (WIB timezone)**.

## Scope
- **Backend**: `backend/src/employees/employees.service.ts` - modify the `vehicleCounts` query
- **Frontend**: `app/pages/index.vue` - update tooltip/label
- **Only affects dashboard** - `/operasional/pemakaian-kendaraan` page unchanged

---

## Changes Required

### 1. Backend: `employees.service.ts` (~line 623)

**Current:**
```typescript
this.prisma.operationalVehicleUsage.groupBy({ by: ['vehicleNumber'], _count: true }),
```

**New:** Add current month WIB filter
```typescript
// Calculate current month boundaries in WIB (UTC+7)
const wibOffsetMs = 7 * 60 * 60 * 1000
const wibNow = new Date(now.getTime() + wibOffsetMs)
const startOfMonthWib = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), 1) - wibOffsetMs)
const endOfMonthWib = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth() + 1, 1) - wibOffsetMs)

// In Promise.all, replace the groupBy with:
this.prisma.operationalVehicleUsage.groupBy({
  by: ['vehicleNumber'],
  where: { usedAt: { gte: startOfMonthWib, lt: endOfMonthWib } },
  _count: true,
}),
```

### 2. Frontend: `app/pages/index.vue` (~line 790)

**Current tooltip:** `Total seluruh data pemakaian`

**New tooltip:** `Total pemakaian bulan ini`

Optionally add month label near the section header.

---

## Edge Cases / Notes

- Uses existing `now` variable (line 454) and WIB offset logic (lines 460-465) - consistent with `vehicleToday`/`vehicleSevenDays`
- Cache invalidation via `DashboardCacheService` already handled on create/cancel
- No migration needed - purely query change

---

## Validation

1. Backend: Verify `getDashboardStats()` returns monthly counts
2. Frontend: Verify dashboard shows "Total pemakaian bulan ini" tooltip
3. Manual test: Add vehicle usage in current month → count increases; add in previous month → count unchanged
4. Verify cache invalidation works after create/cancel