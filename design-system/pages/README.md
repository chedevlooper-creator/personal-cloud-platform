# Sayfa override’ları

Bir sayfa, `MASTER.md`’deki bir kuraldan sapmak zorunda kalırsa **buraya** yazılır. Master’ı kopyalamak yasak; sadece **fark** belgelenir.

## Ne zaman override yazılır?
- Sayfa, master’daki bir şartı pratik olarak ihlal etmek zorundaysa (ör. terminal full-bleed, koyu zorlamalı)
- Ekran çok özel bir bilgi yoğunluğuna sahipse (ör. editör 3-pane)
- 3rd-party component teması master tokenlarına bağlanamıyorsa (xterm, monaco)

## Ne zaman override **yazılmaz**?
- Estetik tercih (master içinde yer alabilirse master’a ekle)
- Tek seferlik yaratıcı dürtü (rejected by default)
- Hata durumu için (master §13 zaten kapsıyor)

## Şablon

```md
# /<route> · override

## Bağlam
Hangi sayfa, niçin özel.

## Sapmalar
- … (yalnız fark)

## Hâlâ master’a uyar
- a11y kontrolleri (§8)
- Token sistemi (§2)
- Hareket süreleri (§6)

## Test
Kabul kriteri: …
```

## Dizinde olanlar
- `chat.md` — `/chats/[id]` ve global chat panel
- `terminal.md` — `/terminal` + workspace terminal
