# Code Wiki Dokümantasyonu — Tasarım (CODE_WIKI.md İyileştirme)

## Bağlam

Repo’da yeni eklenen [docs/CODE_WIKI.md](file:///workspace/docs/CODE_WIKI.md), CloudMind OS monorepo’sunun yapısını ve ana konseptlerini anlatan “kod turu” dokümanıdır. Mevcut hali IDE içinde tıklanabilir `file:///workspace/...` linklerini yoğun kullanıyor; bu linkler GitHub gibi ortamlarda çalışmaz ve zamanla eskime riski taşır.

Bu tasarım, dokümanı “yeni geliştirici + katkı yapan” odaklı, hızlı gezinme sağlayan ve bakımı kolay bir referans haline getirmeyi hedefler.

## Hedefler

- CODE_WIKI.md içindeki linkleri GitHub’da çalışacak şekilde repo-relative formatına taşımak.
- Dokümanın kapsamını “kodda nereden başlanır / hangi dosya nerede” şeklinde netleştirmek.
- Servis/paket açıklamalarını doğrulanabilir referanslara (dosya yolları, belirli giriş noktaları) bağlamak.
- Dokümanın güncel kalmasını kolaylaştıracak bakım kuralları eklemek.

## Hedef Dışı

- Kod değişikliği yapmak veya refactor önermek.
- README.md içeriğini kopyalayıp büyütmek.
- Üretim/ops runbook’larını bu dokümana taşımak (bunlar ayrı docs altında kalmalı).

## Önerilen Yaklaşım (Option 1: Yerinde Cilalama)

### 1) Link Stratejisi

- `file:///workspace/...` linkleri repo-relative linklere çevrilir.
  - Örn: `file:///workspace/services/agent/src/orchestrator.ts#L48` → `../services/agent/src/orchestrator.ts#L48` veya `../services/agent/src/orchestrator.ts` (aynı klasör derinliğine göre).
- Link formatı için kural:
  - “Konsept anlatımı” için dosya linki.
  - “Bu davranışın kanıtı” için mümkünse satır aralığı (#Lx-Ly) linki.
- Dış dokümantasyon linkleri zaten `docs/` altında ise repo-relative tutulur.

### 2) Doküman Yapısı

CODE_WIKI.md aşağıdaki yapıyla sadeleştirilir ve netleştirilir:

1. **Amaç ve Ne Zaman Okunur**
   - README vs CODE_WIKI ayrımı
2. **Repo Haritası**
   - apps / services / packages / infra / scripts ana dizinleri
3. **Mimari Sınırlar**
   - Servis sınırları (Auth/Workspace/Runtime/Agent/Memory/Publish/Browser) kısa ve eylem odaklı cümlelerle
4. **Paylaşılan Paketler**
   - `@pcp/db` ve `@pcp/shared` için:
     - Sorumluluk
     - “Başlangıç dosyaları” (schema index, client, error handler, observability)
5. **Servis Rehberi**
   - Her servis için standart alt başlıklar:
     - Sorumluluklar
     - Entrypoint
     - Ana “service layer” sınıfı
     - Güvenlik/limit/policy noktaları (varsa)
6. **Bağımlılıklar ve Akış Örnekleri**
   - “Kim kimi çağırır?” örnekleri (özellikle auth cookie + correlation id)
7. **Güncel Tutma Kuralları**
   - “Yeni servis eklendiğinde şu 3 şeyi güncelle”
   - “Entrypoint değişirse linkleri düzelt”

### 3) Bakım ve Eskimeyi Önleme

- “Doğrulanabilirlik” kuralı: Önemli iddialar (ör. “şu policy burada enforce ediliyor”) ilgili dosyaya/satırlara linklenir.
- “Kapsam” kuralı: README’de zaten olan kısa “yüksek seviye tanım/diagram” tekrar edilmez; README’ye link verilir.
- “Değişiklik tetikleyicileri” bölümü: Aşağıdaki değişikliklerde doküman güncellemesi zorunlu:
  - Yeni servis/paket eklenmesi
  - Servis portlarının değişmesi
  - Entrypoint dosyalarının yer değiştirmesi
  - Infra dizini veya script adlarının değişmesi

## Kabul Kriterleri

- CODE_WIKI.md içindeki linklerin tamamı repo-relative olup GitHub görüntüsünde tıklanabilir.
- Her servis için en az 1 giriş dosyası (index.ts) ve 1 service-layer dosyası linki bulunur.
- Dokümanda “Güncel Tutma Kuralları” bölümü yer alır ve somut tetikleyiciler içerir.
- Doküman, README’yi tekrar etmek yerine uygun yerlerde README’ye yönlendirir.

## Test / Doğrulama

- Repo içinde CODE_WIKI.md linkleri manuel olarak kontrol edilir (en azından örnek birer tane: packages, 2 servis, 1 infra linki).
- İsteğe bağlı: Basit bir link-lint kontrolü (ileride) tartışılabilir; bu tasarımın kapsamı dışındadır.

## Açık Sorular

- Link formatında tercih: `../path/to/file` mi, yoksa root’tan göreli `../` yerine `/`-benzeri bir yaklaşım mı? (GitHub root-relative link destekler: `/services/...` repo root’a göre.)
- CODE_WIKI.md’nin hedef kitlesi “ops” olacaksa ayrı bir “Operasyonel Harita” dokümanı açılmalı mı?

