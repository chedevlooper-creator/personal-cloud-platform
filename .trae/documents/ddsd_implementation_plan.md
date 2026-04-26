# Personal Cloud Platform Uygulama Planı (DDSD Referanslı)

## Özet
Bu plan, kullanıcı tarafından sağlanan `DDSD` referans dosyasındaki yönergeler doğrultusunda eksik kalan yapılandırma dosyalarının, Cursor kurallarının ve dokümantasyonların oluşturulmasını; ardından sistem kurulum ve git ilklendirme adımlarının gerçekleştirilmesini kapsar.

## Mevcut Durum Analizi
- **Tamamlananlar:** Kök yapılandırma (`package.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierrc`), Docker altyapı dosyaları (`docker-compose.yml`, `.env.example`, `init.sql`), kurulum scripti (`scripts/setup.sh`) ve `packages/db` alt paketi (Drizzle ORM yapısı) oluşturulmuştur.
- **Eksikler:** Projenin dokümantasyon dosyaları (`docs/`), ana proje açıklaması (`README.md`), Cursor asistanı için zorunlu olan kural dosyaları (`.cursor/rules/*.mdc`), projenin bir git reposuna dönüştürülmesi ve ilk altyapı testinin gerçekleştirilmesi.

## Önerilen Değişiklikler ve Adımlar

1. **Dokümantasyon Dosyalarının Çıkartılması (`docs/` klasörü)**
   - `docs/BUILD_PLAN.md`: `DDSD` içerisinden tüm geliştirme fazlarını ve Cursor çalışma akışını içeren planın aktarılması.
   - `docs/DECISIONS.md`: Mimari kararların (ADR) oluşturulması.
   - `docs/PROGRESS.md`: Projenin güncel ilerleme durumunun kaydedilmesi.

2. **Ana `README.md` Dosyasının Oluşturulması**
   - Kök dizinde projenin amacı, mimarisi, klasör yapısı ve kurulum yönergelerini içeren dokümanın oluşturulması.

3. **Cursor AI Kurallarının Oluşturulması (`.cursor/rules/`)**
   - `DDSD` dosyasında listelenen 8 adet `.mdc` dosyasının, Cursor'ın yönlendirilmesi için ilgili klasöre kaydedilmesi:
     - `architecture.mdc`
     - `backend-standards.mdc`
     - `security.mdc`
     - `database.mdc`
     - `agents.mdc`
     - `sandbox.mdc`
     - `frontend.mdc`
     - `testing.mdc`

4. **Sistem Kurulumu ve Git İlklendirme (Execution Katmanı)**
   - Terminal üzerinden `git init` çalıştırılması.
   - `scripts/setup.sh` scriptine çalıştırma yetkisi (`chmod +x`) verilerek çalıştırılması (Docker servislerinin ayağa kaldırılması ve pnpm bağımlılıklarının yüklenmesi).
   - Postgres veritabanının çalıştığını doğrulamak için belirtilen test komutlarının yürütülmesi (`SELECT version();` ve `SELECT * FROM pg_extension;`).
   - Tüm bu dosyalar ve ayarlar tamamlandıktan sonra `git add .` ve `git commit -m "chore: initial project structure with infrastructure"` komutları ile ilk commitin atılması.

## Varsayımlar ve Kararlar
- Yeni oluşturulacak tüm dosyaların içeriği, `c:\Users\isaha\Documents\trae_projects\new\DDSD` dosyası içindeki metinlerden birebir çıkartılarak ilgili yerlere yazılacaktır.
- Docker ve Node.js/pnpm sistemde kurulu varsayılmaktadır (`scripts/setup.sh` bu kontrolü yapacaktır).
- Kurulum esnasında herhangi bir engel ile karşılaşılırsa (örneğin port çakışması) `docker compose` logs kullanılarak debug edilecektir.

## Doğrulama Adımları
- İlgili dosya ve klasörlerin `ls` komutuyla diskte var olduğunun doğrulanması.
- `docker ps` çıktısında `pcp-postgres`, `pcp-redis`, `pcp-minio`, `pcp-traefik`, `pcp-mailhog` konteynerlerinin `Up` (çalışır) durumunda görülmesi.
- `git log -1` komutu ile ilk commit'in başarıyla atıldığının kontrol edilmesi.