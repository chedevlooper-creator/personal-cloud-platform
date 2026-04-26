# Auth Service Phase 1 - Tamamlama Planı

Bu plan, `BUILD_PLAN.md`'de belirtilen ve Auth Service (Faz 1) içerisinde eksik kalan **Audit Logging**, **Google OAuth** ve **Refresh Token** (Session Rotation) özelliklerinin implementasyonunu detaylandırmaktadır.

## 1. Mevcut Durum Analizi
- **Tamamlananlar**: Drizzle ORM kurulumu, temel veritabanı şeması (users, sessions, oauth_accounts), Argon2 ile password hashing, HTTP-only cookie ile session yönetimi, ve temel route'lara (register, login) rate limit eklenmesi.
- **Eksikler**: Kullanıcı hareketlerinin (login, register, logout vb.) veritabanına kaydedilmesi (Audit Logs), Google ile giriş yapabilme yeteneği (OAuth 2.0) ve session süresini güvenli bir şekilde yenileme (Session ID Rotation) işlemi.

## 2. Alınan Kararlar ve Kabuller
- **OAuth Yönlendirmesi**: Kullanıcı Google ile başarılı bir şekilde giriş yaptıktan sonra, `http://localhost:3000/dashboard` gibi bir frontend adresine, cookie'leri ayarlanmış bir şekilde yönlendirilecektir (Frontend Redirect).
- **Refresh Token Stratejisi**: Uygulama JWT yerine stateful session (veritabanı destekli opaque token) kullandığı için, "Refresh Token Rotation" gereksinimi **Session ID Rotation** olarak uygulanacaktır. Yani `/auth/refresh` endpoint'ine istek atıldığında mevcut session silinip yerine yeni bir session ID oluşturularak cookie güncellenecektir.
- **Google OAuth Eklentisi**: Fastify ekosisteminin resmi eklentisi olan `@fastify/oauth2` kullanılacaktır.

## 3. Önerilen Değişiklikler

### Adım 1: Veritabanı Şeması (Audit Logs)
- **Dosya**: `packages/db/src/schema/audit_logs.ts` (Yeni)
- **Aksiyon**: `id`, `user_id`, `action`, `details` (JSONB), `ip_address`, `user_agent` ve `created_at` sütunlarını barındıran `audit_logs` tablosunu oluştur.
- **Dosya**: `packages/db/src/schema/index.ts`
- **Aksiyon**: `audit_logs` tablosunu dışa aktar (export).
- **Dosya**: `packages/db` dizini
- **Aksiyon**: `pnpm generate` ile yeni bir migration dosyası oluştur.

### Adım 2: AuthService Güncellemeleri
- **Dosya**: `services/auth/src/service.ts`
- **Aksiyon**: 
  - `logAudit(action, userId, details, ip, userAgent)` isminde özel bir private/public metod ekle. Bu metod veritabanındaki `audit_logs` tablosuna kayıt atacak.
  - Mevcut `register`, `login` ve `logout` metodlarına `ip` ve `userAgent` parametreleri ekleyerek bu olayların loglanmasını sağla.
  - `handleOAuthLogin(profile, tokens, ip, userAgent)` metodu ekle. Bu metod gelen Google profilini kontrol edip `users` ve `oauth_accounts` tablolarına upsert yapacak ve yeni bir session dönecek.
  - `refreshSession(oldSessionId, ip, userAgent)` metodu ekle. Mevcut session'ı bularak geçersiz kılacak ve yerine yepyeni bir session oluşturacak, ardından bu işlemi audit log olarak kaydedecek.

### Adım 3: Route ve OAuth Entegrasyonu
- **Dosya**: `services/auth/package.json`
- **Aksiyon**: `@fastify/oauth2` paketini projeye dahil et.
- **Dosya**: `services/auth/src/routes.ts`
- **Aksiyon**:
  - `@fastify/oauth2` eklentisini `googleOAuth2` adıyla, `.env`'den alınacak (veya default) client ID/Secret bilgileriyle register et.
  - `startRedirectPath` olarak `/oauth/google/start`, `callbackUri` olarak `/auth/oauth/google/callback` ayarla.
  - `GET /oauth/google/callback` endpoint'inde Google'dan access token alıp `https://www.googleapis.com/oauth2/v2/userinfo` üzerinden kullanıcı bilgilerini çek ve `handleOAuthLogin` fonksiyonunu çağır. Başarılıysa session cookie'sini ayarlayıp frontend'e yönlendir (`reply.redirect`).
  - `POST /refresh` endpoint'i ekle. İstekteki eski `sessionId` cookie'sini okuyup `refreshSession` ile yenile ve yeni cookie'yi dön.
  - Mevcut `/register`, `/login` ve `/logout` endpoint'lerinde `request.ip` ve `request.headers['user-agent']` bilgilerini service katmanına geçir.

## 4. Doğrulama Adımları
1. Veritabanında `audit_logs` tablosunun başarılı bir şekilde oluştuğunu kontrol et (`pnpm generate` ve push veya migrate komutları ile).
2. Yeni eklenen `/auth/refresh` endpoint'inin çalıştığını ve eski session cookie'sinin yerine yenisini atadığını doğrula.
3. Projeyi derle (`pnpm build`) ve hata olmadığından emin ol.
4. AuthService testlerinin (`pnpm test`) başarıyla geçtiğini teyit et. Mevcut testlerdeki method imzalarının (yeni eklenen ip/userAgent parametreleri) uyumlu olduğundan emin ol.
