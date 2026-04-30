# Kapsamlı Proje Analizi Spec

## Neden
Projenin genel mimarisini, bağımlılıklarını, konfigürasyon dosyalarını ve kaynak kodunu inceleyerek potansiyel hataları, güvenlik açıklarını ve iyileştirme alanlarını tespit etmek. Kod kalitesi, performans, bakım kolaylığı ve ölçeklenebilirlik açısından projeyi daha sağlam bir temele oturtmak.

## Neler Değişecek
- Projenin tamamı (frontend, backend servisleri, veritabanı, paylaşılan paketler) analiz edilecek.
- Güvenlik açıkları, performans darboğazları ve kod kalitesi sorunları tespit edilecek.
- Önceliklendirilmiş detaylı bir analiz raporu oluşturulacak.
- (Bu aşama salt okunur bir analiz aşamasıdır, doğrudan kod değişikliği yapılmayacaktır, ancak rapor sonucunda eylem planı çıkarılacaktır).

## Etki
- Etkilenen sistemler: Tüm sistem mimarisi (Web, Auth, Workspace, Runtime, Agent, Memory, Publish servisleri).
- Etkilenen dosyalar: Proje geneli kod tabanı, konfigürasyonlar (Dockerfile, package.json, tsconfig vb.).

## EKLENEN Gereksinimler
### Gereksinim: Proje Analiz Raporu
Sistem, aşağıdaki başlıklarda detaylı bir analiz raporu sunmalıdır:
1. Güvenlik Açıkları
2. Performans Sorunları
3. Kod Kalitesi ve Bakım Kolaylığı
4. Ölçeklenebilirlik

#### Senaryo: Başarılı analiz
- **NE ZAMAN** analiz ajanları tüm modülleri taradığında
- **O ZAMAN** önceliklendirilmiş ve çözüm önerileri içeren kapsamlı bir rapor oluşturulur.
