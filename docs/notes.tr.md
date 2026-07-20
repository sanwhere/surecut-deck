# surecut-deck

Tabletten Windows kontrolü. Bilgisayarda host çalışır, tablette tarayıcıdan açılan arayüz butonları gösterir; butona basınca Windows'ta eylem tetiklenir.

## Çalıştırma

```
start.cmd
```

Sistem tepsisinde bir ikon çıkar; host'u o yönetir.

**Sol tık** duruma göre davranır:
- Tablet bağlıysa → **düzenleyiciyi** açar (zaten açıksa yenisini açmaz, açık olanı öne getirir)
- Bağlı değilse → **sunucu bilgisi**ni açar (adresler + eşleştirme kodu), yani bağlanmak için ihtiyacın olan ekranı

**Sağ tık** → tüm menü: düzenleyici, sürükle bırak, sunucu bilgisi, ayarlar, günlük, başlat/durdur/yeniden başlat.

> Windows 11 yeni tepsi ikonlarını taşma menüsüne saklar. Görev çubuğundaki `^` okuna tıklayıp ikonu dışarı sürükleyerek sabitleyebilirsin.

## İki taraftan da düzenleme

Butonları hem tabletten hem Windows'tan ekleyip tasarlayabilirsin; ikisi de **aynı** web arayüzünü kullanır, yani özellikler birebir aynıdır ve bir tarafta yapılan değişiklik diğerine anında yayılır (`broadcastConfig`).

- **Windows:** Tepsi ikonuna sağ tık → **Düzenleyiciyi Aç**. Web arayüzünü **WebView2 içinde barındıran native bir pencere** açılır. Üstünde bir bırakma şeridi vardır: masaüstünden kısayol sürükleyip bırakabilirsin.
- **Tablet:** Tarayıcıdan aynı adres.

Aynı makineden (`127.0.0.1`) gelen bağlantı eşleştirme kodu istemez — o makinede çalışan her şey zaten doğrudan tuş gönderebildiği için kod sormak güvenlik katmaz, sadece kullanımı zorlaştırırdı. Ağdan gelen bağlantılar kodu istemeye devam eder.

Renk seçiminde 8 hazır rengin yanındaki 🎨 ile istediğin özel rengi verebilirsin. Simge için hazır emoji ızgarasından seç ya da kutuya kendin yaz.

## Kısayolu sürükleyip bırakma

İki yer de çalışır:

- **Düzenleyici penceresinin üstündeki şerit** — düzenlerken elinin altında
- Tepsi ikonuna sağ tık → **Kısayol Sürükle Bırak** (ayrı, küçük pencere)

Masaüstünden bir kısayol, program, klasör veya dosya bırak; hedefi çözülür, **gerçek uygulama ikonu çıkarılır** ve buton hem tablette hem düzenleyicide anında belirir. Hangi sayfaya ekleneceğini şeritteki açılır listeden seçersin.

**Neden native pencere:** Tarayıcılar güvenlik gereği sürüklenen dosyanın *yolunu* vermez, sadece içeriğini. Üstelik Chromium bırakılan bir `.lnk` kısayolunu hedefine çözer, yani sana kısayolu değil hedef dosyanın kendisini verir — yüzlerce megabaytlık bir `.exe` olabilir ve yolu yine öğrenemezsin. Bu yüzden düzenleyici tarayıcı penceresi olmaktan çıkarılıp WebView2 barındıran native bir pencereye dönüştürüldü: içindeki arayüz aynı, ama kabuk native olduğu için gerçek dosya yollarını alabiliyor.

WebView2 sarmalayıcı DLL'leri `tray\` altında, exe'nin **yanında** durur. `lib\` gibi bir alt klasöre koyarsan .NET onları çalışma zamanında bulamaz ve düzenleyici sessizce tarayıcı yedeğine düşer.

`.lnk` çözümü `WScript.Shell` COM'u ile yapılır (hedef, argümanlar, ikon konumu). İkon önce `SHDefExtractIconW` ile 128px istenir; başarısız olursa 32px'lik `ExtractAssociatedIcon` yedeğine düşer — `.url` uzantılı internet kısayollarında genelde bu olur, o yüzden onların ikonu biraz yumuşak görünür.

Sürükle-bırakı komut satırından test etmek için:

```
tray\SurecutDeck.exe --drop "C:\Users\...\Bir Kisayol.lnk"
```

Sonucu `data\droptest.log`'a yazar. PowerShell'den çağırırken argümanı **tek string** ver (`-ArgumentList '--drop "yol"'`); virgülle ayırırsan boşluklu yollar bölünür.

## Diller

Arayüz 20 dilde: İngilizce, Türkçe, İspanyolca, Fransızca, Almanca, İtalyanca, Portekizce, Rusça, Ukraynaca, Lehçe, Arapça, Farsça, Urduca, Çince, Japonca, Korece, Hintçe, Bengalce, Endonezce, Vietnamca.

Dil **cihaz başına** saklanır (`localStorage`), `config.settings` içinde değil: tablet ile masaüstünü farklı kişiler kullanabilir, birinin dili diğerini değiştirmesin. Seçim yapılmamışsa tarayıcının dili kullanılır. Tema panelinin en üstünden ve eşleştirme ekranından değiştirilir.

Arapça, Farsça ve Urduca için `<html dir="rtl">` otomatik ayarlanır.

Çeviriler `public/i18n.js` içinde tek dosyada, düz bir anahtar-değer sözlüğü. Yeni dil eklemek için `I18N.xx = { ... }` bloğu ve `LANG_NAMES`'e bir satır yeterli. Eksik bir anahtar İngilizceye düşer, o da yoksa anahtarın kendisi görünür — yani eksik çeviri arayüzü bozmaz.

`node data\i18ntest.js` bütün dilleri denetler: eksik/fazla/boş anahtar ve `{name}` gibi yer tutucuların tutarlılığı.

> Çevirilerin bir kısmı doğrulanmadı. İngilizce, Türkçe ve büyük Avrupa dilleri makul durumda; Bengalce, Urduca, Farsça, Hintçe gibi dillerde anadili konuşan biri gözden geçirmeli.

## Temalar

Başlıktaki 🎨 ile tema paneli açılır. On bir tema var; çoğu bilinen geliştirici renk şemalarının **resmi paletlerinden** alındı.

| Tema | Karakter | Kaynak |
|---|---|---|
| Karanlık | Nötr gri, varsayılan | — |
| Nord | Soğuk kutup mavisi | [nordtheme.com](https://www.nordtheme.com/docs/colors-and-palettes) |
| Gruvbox | Sıcak retro, kahve ve hardal | [morhetz/gruvbox](https://github.com/morhetz/gruvbox) |
| Solarized | Teal taban, koyu | [ethanschoonover.com](https://ethanschoonover.com/solarized/) |
| Mocha | Mor pastel, yumuşak | [Catppuccin](https://catppuccin.com/palette/) |
| Rosé Pine | Erik ve gül, loş | [rose-pine/palette](https://github.com/rose-pine/palette) |
| Kehribar | **İki renkli**, eski terminal | — |
| Fosfor | **İki renkli**, yeşil CRT | — |
| Aydınlık | Nötr beyaz | — |
| Solarized Açık | Krem kağıt tonu | [ethanschoonover.com](https://ethanschoonover.com/solarized/) |
| Dawn | Sıcak açık, gül tonu | [rose-pine/palette](https://github.com/rose-pine/palette) |

Her temanın kendi buton renk paleti ve varsayılan vurgu rengi var; vurgu rengini ayrıca kendin seçebilirsin. Tema ayarı `config.settings` içinde tutulur, yani tabletle Windows ortak kullanır.

**Tema değiştirdiğinde buton renkleri de dönüşür**, ama tonları korunarak: mavi buton yeni temanın mavisi, kırmızı olan kırmızısı olur. Kurduğun renk düzeni bozulmaz, sadece palet değişir. Eşleme HSL tonuna göre yapılır; renklilik ölçüsü olarak **kroma** kullanılır (HSL doygunluğu uç parlaklıklarda yanıltıyor: `#d8dee9` gözle gri olmasına rağmen doygunluğu 0.28 çıkıp mavinin en yakın adayı oluyordu).

Elle yeniden renklendirmek için iki seçenek var:

- **Tema paletine dağıt** — butonlar sırayla temanın 8 renginden alır: çeşitli ama uyumlu
- **Hepsini vurgu rengine boya** — tek renk: en sade ve en tutarlı görünüm

Buton yazı rengi zeminin parlaklığına göre otomatik seçilir (WCAG bağıl parlaklık). Kehribar/Fosfor gibi parlak zeminlerde ve açık özel renklerde sabit beyaz yazı okunmuyordu.

Gövde renkleri CSS'te `:root[data-theme="..."]` altında değişkenlerle tanımlı. Yeni tema eklemek için üç ekleme yeterli: `style.css`'e bir değişken bloğu, `app.js` içindeki `THEMES` sabitine bir giriş, ve `style.css`'teki `.theme-card[data-preview="..."]` önizleme satırı.

## Fare kontrolü (touchpad)

Eylem tipi **Fare (touchpad aç)** olan bir buton, tablet ekranını tam ekran bir touchpad'e çevirir. Bu eylem istemci tarafında çalışır; sunucuya gönderilmez.

| Jest | Sonuç |
|---|---|
| Sürükle | İmleci hareket ettirir |
| Dokun | Sol tık |
| Çift dokun | Çift tık |
| Çift dokun + sürükle | Sol tuş basılı sürükleme (metin seçme, pencere taşıma) |
| Uzun bas (0,55 sn) | Sağ tık |
| İki parmak sürükle | Dikey ve yatay kaydırma |
| İki parmakla dokun | Sağ tık |
| Kıstır / aç | Yakınlaştır / uzaklaştır (Ctrl+tekerlek) |
| Üç parmak ↑ / ↓ | Görev görünümü / masaüstünü göster |
| Üç parmak ← / → | Sanal masaüstleri arasında geçiş |

Alttaki dört düğme (Sol, Orta, Sağ, Tut) doğrudan tıklama sağlar; **Tut** sol tuşu kilitler, sürükleme işleri için.

Hassasiyet üstteki kaydırıcıdan ayarlanır ve `config.settings.mouseSensitivity` içinde saklanır.

**Çift dokunma neden özel kod istemiyor:** ilk dokunuş zaten bir sol tık gönderir, ikincisi bir tane daha; art arda gelen iki tık işletim sistemi tarafından çift tık olarak yorumlanır. Çift dokunuşu beklemek için ilk tıkı geciktirseydik her tek tık ~300 ms gecikirdi.

**Kaydırma neden kesirli gönderilir:** Tekerlek olayları 120 birimlik çentiklere bölünür. Tam çentiğe yuvarlarsan hem küçük hareketler hiç işlenmez ("dokunup beklemek gerekiyor"), hem de kaydırma zıplayarak ilerler. Bu yüzden çentiğin kesri gönderilir (`MSCROLL 0.25` → 30 birim).

**İki parmakta mod kilidi:** Parmaklar arası mesafe doğal olarak birkaç piksel oynadığı için, kıstırma ile kaydırmayı her karede yeniden değerlendirirsen sürekli kıstırmaya atlayıp kaydırmayı bloklar. Jest başında bir kez mod seçilir (`scroll` veya `pinch`) ve jest bitene kadar korunur.

**İki parmakta varsayılan kaydırmadır.** Eşik bekleyip sonra karar vermek "geç algılıyor" hissi veriyordu. Artık iki parmak değer değmez kaydırma başlar; yalnızca ilk 350 ms içinde net bir kıstırma imzası görülürse yakınlaştırmaya geçilir. Kaydırma için beklenecek hiçbir eşik yok.

Touchpad başlığında üç ayar var: **İmleç** hızı, **Kaydırma** hızı ve **Yön** (Normal / Ters). Normal, Windows dokunmatik yüzeyiyle aynıdır (parmak aşağı = sayfa aşağı); Ters, dokunmatik ekran mantığıdır. Üçü de `config.settings` içinde saklanır, yani tablet ve Windows ortak kullanır.

**Teşhis:** `GET /api/status` içindeki `mouse` sayacı hangi olayların sunucuya ulaştığını gösterir (`{"move":304,"scroll":27,"click":1}`). Çok parmaklı jestler adb ile simüle edilemediği için (SELinux `sendevent`'i engelliyor) test bu sayaçlarla yapılır.

**Yakınlaştırma neden tek komut:** Ctrl'yi "bas → kaydır → bırak" diye üç ayrı tura bölmek riskli; arada bir mesaj düşerse **Ctrl basılı kalır ve bilgisayar kullanılamaz hale gelir**. Bu yüzden `MZOOM` yardımcı içinde tek çağrıda, `finally` ile yapılır.

## Ekrana yayma

Tema panelindeki **Butonları ekrana yay** seçeneği açıkken satırlar mevcut yüksekliği paylaşır; buton sayısı ne olursa olsun altta boşluk kalmaz. 5 sütun 2 satır olduğunda butonlar uzar ve ekranı doldurur.

Grid kuralı `grid-auto-rows: minmax(64px, 1fr)`. `1fr` satırların yüksekliği paylaşmasını sağlar; `minmax` ile 64 piksellik alt sınır ise çok satır olduğunda butonların okunamayacak kadar incelmesini engeller, o durumda ızgara kaydırılır.

## Çubukları otomatik gizleme ve yüzen menü

Tema panelindeki **Üst ve alt çubukları otomatik gizle** seçeneği açıkken üst başlık ve alt düzenleme çubuğu kaybolur; ekranda sadece butonlar kalır. Düzenleme modundayken gizleme devre dışıdır.

Çubukları geri getirmenin iki yolu var:

- **Yüzen menü butonu** (☰) — her zaman görünür, sürükleyerek istediğin yere taşınır, konumu kaydedilir
- Izgaranın **boş** bir alanına 3 saniye basılı tutmak

İkincisi tek başına yetmiyordu: ızgara doluyken (örneğin 5 sütun) basılacak boş alan kalmıyor ve **çubukları geri getirmenin hiçbir yolu olmuyordu**. Ayrıca sayfa sekmeleri başlıkta olduğu için çubuklar gizliyken sayfa değiştirmek de mümkün değildi; bu yüzden menüde sayfa listesi de var.

Menü: sayfalar, çubukları göster, düzenle, tema, tam ekran. Butonu tema panelinden gizleyebilirsin.

## Eşzamanlı düzenleme koruması

Sunucu bir `revision` sayacı tutar; her değişiklikte artar ve istemcilere gönderilir. İstemci kaydederken elindeki sürümü bildirir, uyuşmazsa **kayıt reddedilir** ve o istemciye güncel yapılandırma gönderilir.

Bu koruma olmadan eski bir sekme kendi bayat kopyasını üzerine yazıp aradaki değişiklikleri siliyordu — sürükle-bırakla eklenen bir buton bu şekilde kaybolmuştu. Yeni bir yazma yolu eklerken `revision++` yapmayı unutma.

Test: `node data\revisiontest.js`

## Otomatik yenileme

Sunucu, arayüz dosyalarının değişiklik zamanını her mesajda gönderir; istemci değişiklik görünce kendini yeniler. Çalışan bir sayfa kendi JavaScript'ini yeniden çekmediği için bu olmadan her kod değişikliğinden sonra tableti elle yenilemek gerekiyordu.

Tabletten `http://<IP>:8791` adresini Chrome'da aç, kodu gir. Sağ üstteki **⛶** ile tam ekrana geç; tercih hatırlanır ve sonraki açılışta ilk dokunuşta kendiliğinden tam ekrana girer. Tam ekranda ekran kilidi (wake lock) devreye girer, tablet uykuya dalmaz.

Kalıcı çözüm için Chrome menüsünden **Ana ekrana ekle** de; uygulama olarak açılır.

## Mimari

| Parça | Dosya | Görev |
|---|---|---|
| Tray | `tray/TrayApp.cs` → `SurecutDeck.exe` | Node'u çocuk süreç olarak yönetir, ayar/durum arayüzü |
| Host | `server.js` | HTTP + WebSocket, yapılandırma, eylem yürütme |
| Tuş enjeksiyonu | `helper/InputHelper.cs` → `.exe` | Win32 `SendInput`, stdin protokolü |
| İstemci | `public/` | Buton ızgarası, düzenleyici, tam ekran |
| Buton verisi | `data/config.json` | Sayfalar ve butonlar (sadece istemci yazar) |
| Eşleştirme kodu | `data/token.txt` | Tray okur/yeniler |
| Host ayarı | `data/host.ini` | Port, başlangıç tercihi |

Token ve port bilerek `config.json` dışında tutuluyor: tray bunları değiştirirken kullanıcının buton yapılandırmasına hiç dokunmuyor, JSON'u yeniden yazıp bozma riski olmuyor.

Tray da `csc.exe` ile derleniyor (WinForms `NotifyIcon`). Derleyici .NET Framework'ün eski sürümü olduğu için **C# 6+ sözdizimi kullanılamaz**: string interpolation (`$""`), `?.`, `nameof` derlenmez.

Tuş gönderimi için PowerShell `SendKeys` yerine C# + `SendInput` kullanılıyor: `SendKeys` Win tuşunu ve medya tuşlarını gönderemez. Yardımcı uzun ömürlü çalışır, her tuşta process açma gecikmesi olmaz.

`csc.exe` Windows ile birlikte gelen .NET Framework derleyicisidir, ek kurulum gerekmez. Kaynağı değiştirirsen `build-helper.cmd` ile yeniden derle.

## Eylem tipleri

| Tip | Alanlar | Örnek |
|---|---|---|
| `hotkey` | `keys` | `ctrl+shift+esc`, `win+d`, `volumeup` |
| `text` | `text` | Metni tuş tuş yazar |
| `launch` | `target`, `args` | `notepad.exe`, `C:\proje` |
| `url` | `url` | Sadece http/https |
| `command` | `shell`, `command` | PowerShell veya CMD |
| `sequence` | `steps[]` | Adımları sırayla çalıştırır |
| `delay` | `ms` | Sadece `sequence` içinde anlamlı |

Sıralı adımlar arayüzde satır satır yazılır:

```
key ctrl+c
delay 200
key alt+tab
key ctrl+v
```

## Güvenlik

- Host `0.0.0.0` dinler ama her WebSocket bağlantısı **eşleştirme kodu** ister; kod `data/config.json` içinde tutulur ve istemciye geri gönderilmez.
- Kod karşılaştırması sabit sürelidir (`timingSafeEqual`), deneme-yanılma zorlaşır.
- Kodu değiştirmek için `data/config.json` içindeki `token` alanını sil, host'u yeniden başlat; yenisi üretilir.
- `command` eylemi keyfi komut çalıştırır. Kodu bilen herkes bilgisayarda komut çalıştırabilir demektir, o yüzden kodu paylaşma ve host'u güvenmediğin ağlarda açma.

## Test

```
node data\smoketest.js <eslestirme-kodu>
```

Tuş enjeksiyonunu NumLock'u açıp kapatarak doğrular, sonra eski haline döndürür. Odak çalmaz, veri kaybettirmez.

## Bilinen tuzaklar

- **Güvenlik duvarı:** İlk çalıştırmada Windows gelen bağlantı için izin sorabilir. Sormazsa ve tablet bağlanamıyorsa yönetici PowerShell'de:
  `New-NetFirewallRule -DisplayName "surecut-deck" -Direction Inbound -Protocol TCP -LocalPort 8791 -Action Allow -Profile Private`
- **VPN:** NordVPN gibi istemciler yerel ağ trafiğini bloklayabilir. Tablet bağlanamıyorsa VPN'i kapatıp dene, ya da Tailscale IP'sini kullan.
- **Yönetici pencereleri:** Windows, normal yetkiyle çalışan bir sürecin yönetici olarak çalışan pencerelere tuş göndermesini engeller (UIPI). Görev Yöneticisi gibi pencerelere kısayol göndermek istiyorsan host'u yönetici olarak başlat.
