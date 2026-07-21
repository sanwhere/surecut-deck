// Native kabugun (tepsi menusu, duzenleyici, bilgi ve ayar pencereleri)
// metinleri. Tablet arayuzu public\i18n.js ile yirmi dil konusuyordu ama bu
// taraf yalnizca Turkce idi; indiren herkes Turkce bir menuyle karsilasiyordu.
//
// Dil, Windows'un arayuz dilinden secilir. Bilinmeyen bir dilde Ingilizceye
// duser: varsayilan Turkce olsaydi dunyanin geri kalani okuyamazdi.
//
// SURECUT_LANG ortam degiskeni secimi ezer; sinama ve ekran goruntusu icin.
//
// NOT: .NET Framework'un eski csc.exe'si ile derlenir (C# 5).
// String interpolation ($""), ?., nameof KULLANILAMAZ.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;

static partial class L
{
    static Dictionary<string, Dictionary<string, string>> all;
    static Dictionary<string, string> cur;
    static Dictionary<string, string> fallback;

    // Metni anahtarindan verir. Anahtar secili dilde yoksa Ingilizceye,
    // o da yoksa anahtarin kendisine duser; eksik ceviri cokme sebebi olmasin.
    public static string T(string key)
    {
        if (cur == null) Init();
        string v;
        if (cur.TryGetValue(key, out v)) return v;
        if (fallback.TryGetValue(key, out v)) return v;
        return key;
    }

    public static string Lang { get; private set; }

    static void Init()
    {
        Build();
        fallback = all["en"];

        string want = Environment.GetEnvironmentVariable("SURECUT_LANG");
        if (string.IsNullOrEmpty(want))
        {
            try { want = Thread.CurrentThread.CurrentUICulture.TwoLetterISOLanguageName; }
            catch { want = "en"; }
        }
        if (want != null) want = want.ToLowerInvariant();

        Lang = (want != null && all.ContainsKey(want)) ? want : "en";
        cur = all[Lang];
    }

    // Sagdan sola dillerde pencereyi aynala: metni cevirmek yetmiyor,
    // dugme ve sutun sirasi da ters olmali.
    static readonly string[] RtlLangs = new string[] { "ar", "fa", "ur" };

    public static bool IsRtl
    {
        get
        {
            if (cur == null) Init();
            return Array.IndexOf(RtlLangs, Lang) >= 0;
        }
    }

    public static void ApplyRtl(System.Windows.Forms.Control c)
    {
        if (!IsRtl) return;
        c.RightToLeft = System.Windows.Forms.RightToLeft.Yes;
        // RightToLeftLayout KULLANILMIYOR: pencerenin aygit baglamini tumden
        // aynaliyor ve cizilen her sey, Latin metin dahil, ters donebiliyor.
        // RightToLeft tek basina metni saga yaslar ve denetim sirasini cevirir,
        // ki RTL bir kullanicinin bekledigi de bu.
    }

    static void Add(string lang, string[] pairs)
    {
        Dictionary<string, string> d = new Dictionary<string, string>();
        for (int i = 0; i + 1 < pairs.Length; i += 2) d[pairs[i]] = pairs[i + 1];
        all[lang] = d;
    }

    static void Build()
    {
        all = new Dictionary<string, Dictionary<string, string>>();

        Add("en", new string[] {
            "alreadyRunning", "surecut-deck is already running.",
            "running", "● Running  ·  port ",
            "stopped", "○ Stopped",
            "pairCode", "Pairing code:  ",
            "openEditor", "Open Editor",
            "dragDrop", "Drag and Drop a Shortcut…",
            "serverInfo", "Server Details…",
            "openInBrowser", "Open Interface in Browser",
            "copyAddress", "Copy Connection Address",
            "settings", "Settings…",
            "log", "Log…",
            "restart", "Restart",
            "stop", "Stop",
            "start", "Start",
            "quit", "Quit",
            "nodeFailed", "Node.js could not be started:\n\n",
            "nodeFailedHint", "\n\nNode.js must be installed and on PATH.",
            "trayRunning", "surecut-deck: running (port ",
            "trayStopped", "surecut-deck: stopped",
            "notGenerated", "(not generated yet)",
            "editorFellBack", "The editor window could not open, using the browser instead. Details: Log",
            "copied", "Copied: ",
            "newCode", "New pairing code: ",
            "newCodeHint", "\n\nThe tablet will be disconnected and will need the new code.",
            "autoStartFailed", "Could not set up automatic start: ",
            "dropTitle", "surecut-deck: Drag and Drop",
            "dropZone", "Drag a shortcut from your desktop\r\nand drop it here\r\n\r\n(a program, folder or file works too)",
            "alwaysOnTop", "Always on top",
            "whichPage", "Which page to add to",
            "refresh", "Refresh",
            "added", "Added",
            "close", "Close",
            "iconYes", "  (icon ✓)",
            "iconNo", "  (no icon)",
            "hostNotRunning", "(host not running)",
            "infoTitle", "surecut-deck: Server Details",
            "pairCodeLabel", "Pairing code",
            "copyCode", "Copy Code",
            "addressHint", "Open one of these on the tablet (double click to copy)",
            "colAddress", "Address",
            "colInterface", "Network interface",
            "settingsTitle", "surecut-deck: Settings",
            "port", "Port",
            "portHint", "Changing this restarts the host and changes the address on the tablet.",
            "startWithWindows", "Start with Windows",
            "startMinimized", "Do not open a window at startup (tray only)",
            "regenCode", "Regenerate the pairing code",
            "regenHint", "Connected tablets will be disconnected and will need the new code.",
            "addFirewall", "Add a firewall rule (requires administrator)",
            "save", "Save",
            "cancel", "Cancel",
            "firewallAdded", "Firewall rule added (port ",
            "firewallAddedTail", ", Private profile).",
            "firewallFailed", "The rule could not be added. Was administrator approval given?",
            "firewallError", "The rule could not be added: ",
            "logTitle", "surecut-deck: Log",
            "dropHere", "Drop a shortcut from your desktop anywhere in this window: its target and icon are picked up automatically",
            "dropNow", "Drop it",
            "uiFailed", "The interface could not load:\r\n",
            "uiFailedHint", "\r\n\r\nThe WebView2 runtime may not be installed.\r\nYou can continue with \"Open Interface in Browser\" from the tray menu.",
            "buttonsAdded", " buttons added",
            "browse", "Choose a shortcut…",
            "browseTitle", "Choose a shortcut, program, folder or file",
            "browseFilter", "Shortcuts and programs|*.lnk;*.url;*.exe|All files|*.*"
        });

        Add("tr", new string[] {
            "alreadyRunning", "surecut-deck zaten çalışıyor.",
            "running", "● Çalışıyor  ·  port ",
            "stopped", "○ Durdu",
            "pairCode", "Eşleştirme kodu:  ",
            "openEditor", "Düzenleyiciyi Aç",
            "dragDrop", "Kısayol Sürükle Bırak…",
            "serverInfo", "Sunucu Bilgisi…",
            "openInBrowser", "Arayüzü Tarayıcıda Aç",
            "copyAddress", "Bağlantı Adresini Kopyala",
            "settings", "Ayarlar…",
            "log", "Günlük…",
            "restart", "Yeniden Başlat",
            "stop", "Durdur",
            "start", "Başlat",
            "quit", "Çıkış",
            "nodeFailed", "Node.js başlatılamadı:\n\n",
            "nodeFailedHint", "\n\nNode.js kurulu ve PATH'te olmalı.",
            "trayRunning", "surecut-deck: çalışıyor (port ",
            "trayStopped", "surecut-deck: durdu",
            "notGenerated", "(henüz üretilmedi)",
            "editorFellBack", "Düzenleyici penceresi açılamadı, tarayıcıda açılıyor. Ayrıntı: Günlük",
            "copied", "Kopyalandı: ",
            "newCode", "Yeni eşleştirme kodu: ",
            "newCodeHint", "\n\nTabletteki bağlantı kesilecek, yeni kodu girmen gerekecek.",
            "autoStartFailed", "Otomatik başlatma ayarlanamadı: ",
            "dropTitle", "surecut-deck: Sürükle Bırak",
            "dropZone", "Masaüstündeki kısayolu\r\nburaya sürükle bırak\r\n\r\n(program, klasör veya dosya da olur)",
            "alwaysOnTop", "Her zaman üstte",
            "whichPage", "Hangi sayfaya eklensin",
            "refresh", "Yenile",
            "added", "Eklenenler",
            "close", "Kapat",
            "iconYes", "  (simge ✓)",
            "iconNo", "  (simge yok)",
            "hostNotRunning", "(host çalışmıyor)",
            "infoTitle", "surecut-deck: Sunucu Bilgisi",
            "pairCodeLabel", "Eşleştirme kodu",
            "copyCode", "Kodu Kopyala",
            "addressHint", "Tabletten bu adreslerden birini aç (çift tıkla → kopyala)",
            "colAddress", "Adres",
            "colInterface", "Ağ arayüzü",
            "settingsTitle", "surecut-deck: Ayarlar",
            "port", "Port",
            "portHint", "Değiştirirsen host yeniden başlar ve tabletteki adres değişir.",
            "startWithWindows", "Windows açılışında başlat",
            "startMinimized", "Başlarken pencere açma (sadece tepside dursun)",
            "regenCode", "Eşleştirme kodunu yenile",
            "regenHint", "Bağlı tabletlerin bağlantısı kesilir, yeni kodu girmeleri gerekir.",
            "addFirewall", "Güvenlik duvarı kuralı ekle (yönetici ister)",
            "save", "Kaydet",
            "cancel", "İptal",
            "firewallAdded", "Güvenlik duvarı kuralı eklendi (port ",
            "firewallAddedTail", ", Özel profil).",
            "firewallFailed", "Kural eklenemedi. Yönetici onayı verildi mi?",
            "firewallError", "Kural eklenemedi: ",
            "logTitle", "surecut-deck: Günlük",
            "dropHere", "Masaüstündeki kısayolu pencerenin herhangi bir yerine bırak: hedefi ve simgesi otomatik alınır",
            "dropNow", "Bırak",
            "uiFailed", "Arayüz yüklenemedi:\r\n",
            "uiFailedHint", "\r\n\r\nWebView2 çalışma zamanı kurulu olmayabilir.\r\nTepsi menüsünden \"Arayüzü Tarayıcıda Aç\" ile devam edebilirsin.",
            "buttonsAdded", " buton eklendi",
            "browse", "Kısayol seç…",
            "browseTitle", "Kısayol, program, klasör veya dosya seç",
            "browseFilter", "Kısayol ve programlar|*.lnk;*.url;*.exe|Tüm dosyalar|*.*"
        });

        BuildRest();
    }

    // Diger diller uretilen dosyada (Strings.Generated.cs). Kismi metot:
    // o dosya yoksa cagri derleyici tarafindan silinir ve en/tr ile calisir.
    static partial void BuildRest();
}
