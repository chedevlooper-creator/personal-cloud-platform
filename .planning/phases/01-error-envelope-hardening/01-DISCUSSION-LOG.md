# Phase 1: Error Envelope Hardening - Discussion Log

**Date:** 2026-05-06
**Areas discussed:** 4

---

## Area 1: Error Class Taxonomy

**Question:** `@pcp/shared`'ta tek bir `DomainError` hiyerarşisi mi oluşturalım, yoksa her servis kendi `ServiceError`'ünü mü tutsun?

**Options presented:**
- Tek merkezi hiyerarşi (Önerilen)
- Servis-başına error class'ları
- Mevcut `WorkspaceError`'ı genişlet

**User selection:** Tek merkezi hiyerarşi

**Rationale:** Tüm servisler aynı hiyerarşiyi kullanır. `statusCode` ve `code` constructor'da set edilir. Route'lar `instanceof` ile yakalar.

**Decision:** D-01, D-02, D-03

---

## Area 2: 500 Message Policy

**Question:** Browser ve datasets route'larındaki custom catch blokları 500 hatalarda `err.message`'i client'a sızdırıyor. Ne yapalım?

**Options presented:**
- Tüm 500'ler generic (Önerilen)
- Güvenli mesaj whitelist'le

**User selection:** Tüm 500'ler generic

**Rationale:** `statusCode >= 500` olan tüm hatalarda client'a sadece 'Internal server error' dön. Detaylar sadece server log'larına (`pino` ile `correlationId` altında) gider.

**Decision:** D-04, D-05

---

## Area 3: Migration Scope

**Question:** Audit sadece runtime, publish, agent servislerini ve browser/datasets route'larını işaret ediyor. Tüm 7 servisi mi kapsamalıyız?

**Options presented:**
- Audit'in işaret ettikleri + browser/datasets (Önerilen)
- Tüm 7 servisi kapsa

**User selection:** Audit'in işaret ettikleri + browser/datasets

**Rationale:** Diğer servisler (auth, memory, workspace) zaten `sendApiError` + `WorkspaceError` ile düzgün çalışıyor. Daha hızlı, daha az risk.

**Decision:** D-06

---

## Area 4: Driver Error Wrapping Depth

**Question:** DB/pg/Redis/MinIO hataları hangi katmanda wrap edilmeli?

**Options presented:**
- Repository katmanında wrap (Önerilen)
- Service katmanında wrap

**User selection:** Repository katmanında wrap

**Rationale:** Repository fonksiyonları `pg`/`drizzle` hatalarını yakalayıp domain error'a çevirir. Service katmanı sadece domain error görür. Route katmanı `instanceof DomainError` ile yakalar.

**Decision:** D-07, D-08

---

## Deferred Ideas

None.

---

*Phase: 1-Error Envelope Hardening*
*Discussion completed: 2026-05-06*
