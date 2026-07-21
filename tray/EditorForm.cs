// Native duzenleyici penceresi: web arayuzunu WebView2 icinde barindirir,
// ama pencerenin kendisi native oldugu icin masaustunden birakilan dosyalarin
// GERCEK YOLUNU alabilir. Tarayici bunu guvenlik geregi vermez ve ustelik
// Chromium birakilan .lnk kisayolunu hedefine cozup dosyanin kendisini verir,
// yani tarayici icinde bu is hic yapilamaz.
//
// NOT: .NET Framework'un eski csc.exe'si ile derlenir (C# 5).
// String interpolation ($""), ?., nameof KULLANILAMAZ.

using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

class EditorForm : Form
{
    readonly HostSettings settings;
    readonly DropForm dropHelper;      // .lnk cozme ve ikon cikarma islerini yeniden kullan

    WebView2 web;
    Panel dropBar;
    Label dropLabel;
    ComboBox cboPage;
    bool webReady;

    static readonly Color BarIdle = Color.FromArgb(244, 246, 249);
    static readonly Color BarHover = Color.FromArgb(206, 231, 255);

    public EditorForm(HostSettings s, DropForm helper)
    {
        settings = s;
        dropHelper = helper;

        Text = "surecut-deck";
        Size = new Size(1180, 800);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9f);
        AllowDrop = true;
        MinimumSize = new Size(720, 480);
        L.ApplyRtl(this);

        // --- ustte birakma seridi ---
        dropBar = new Panel();
        dropBar.Dock = DockStyle.Top;
        dropBar.Height = 62;
        dropBar.BackColor = BarIdle;
        dropBar.AllowDrop = true;
        dropBar.DragEnter += Drop_DragEnter;
        dropBar.DragLeave += Drop_DragLeave;
        dropBar.DragDrop += Drop_DragDrop;
        Controls.Add(dropBar);

        dropLabel = new Label();
        dropLabel.Text = L.T("dropHere");
        dropLabel.Dock = DockStyle.Fill;
        dropLabel.TextAlign = ContentAlignment.MiddleCenter;
        dropLabel.ForeColor = Color.FromArgb(90, 96, 106);
        dropLabel.Font = new Font("Segoe UI", 10f);
        dropLabel.AllowDrop = true;
        // Etiket seridi kapladigi icin surukleme olaylarini o da almali.
        dropLabel.DragEnter += Drop_DragEnter;
        dropLabel.DragLeave += Drop_DragLeave;
        dropLabel.DragDrop += Drop_DragDrop;
        dropBar.Controls.Add(dropLabel);

        cboPage = new ComboBox();
        cboPage.DropDownStyle = ComboBoxStyle.DropDownList;
        cboPage.Width = 190;
        cboPage.Location = new Point(12, 19);
        cboPage.Anchor = AnchorStyles.Left | AnchorStyles.Top;
        // Yeni sayfa eklenince listede gorunsun: her acilista tazele.
        cboPage.DropDown += delegate { LoadPages(); };
        dropBar.Controls.Add(cboPage);
        cboPage.BringToFront();

        // --- web arayuzu ---
        web = new WebView2();
        web.Dock = DockStyle.Fill;
        web.CoreWebView2InitializationCompleted += Web_Ready;
        Controls.Add(web);
        web.BringToFront();

        Load += delegate { StartWeb(); LoadPages(); };
    }

    void StartWeb()
    {
        try
        {
            // Kullanici verisi proje icinde kalsin, sistem profiline dagilmasin.
            string udf = Path.Combine(Paths.Root, "data\\webview2");
            Directory.CreateDirectory(udf);
            CoreWebView2Environment env = CoreWebView2Environment
                .CreateAsync(null, udf, null).GetAwaiter().GetResult();
            web.EnsureCoreWebView2Async(env);
        }
        catch (Exception ex)
        {
            ShowWebError(ex.Message);
        }
    }

    void Web_Ready(object sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            ShowWebError(e.InitializationException != null ? e.InitializationException.Message : "bilinmeyen hata");
            return;
        }

        webReady = true;

        CoreWebView2Settings s = web.CoreWebView2.Settings;
        s.AreDefaultContextMenusEnabled = false;
        s.IsStatusBarEnabled = false;
        s.AreBrowserAcceleratorKeysEnabled = false;

        // WebView2 kendi icine birakilan dosyalari yutmasin: sayfaya birakilan
        // bir kisayoru tarayici hedefine cozup icerigini okumaya calisir, oysa
        // bize gereken dosyanin YOLU.
        try { web.AllowExternalDrop = false; }
        catch { /* eski surumlerde bu ozellik yok, serit yine calisir */ }

        // Ama yutmamasi tek basina yetmiyordu: yerine kimse gecmeyince pencerenin
        // govdesine birakilan hicbir sey kabul edilmiyor, kullanicinin tepedeki
        // dar seride nisan almasi gerekiyordu. Denetimin kendisini de hedef
        // yapiyoruz, boylece pencerenin herhangi bir yerine birakmak calisiyor.
        // WebView2 sarmalayicisi AllowDrop'u salt okunur olarak golgeliyor;
        // temel Control uzerinden atiyoruz.
        ((Control)web).AllowDrop = true;
        web.DragEnter += Drop_DragEnter;
        web.DragOver += Drop_DragEnter;
        web.DragLeave += Drop_DragLeave;
        web.DragDrop += Drop_DragDrop;

        web.CoreWebView2.Navigate("http://127.0.0.1:" + settings.Port + "/");
    }

    void ShowWebError(string msg)
    {
        Label err = new Label();
        err.Dock = DockStyle.Fill;
        err.TextAlign = ContentAlignment.MiddleCenter;
        err.Text = L.T("uiFailed") + msg +
                   
                   L.T("uiFailedHint");
        err.Font = new Font("Segoe UI", 10f);
        Controls.Add(err);
        err.BringToFront();
    }

    // ------------------------------------------------------------ surukle birak

    void Drop_DragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            e.Effect = DragDropEffects.Copy;
            dropBar.BackColor = BarHover;
            dropLabel.Text = L.T("dropNow");
        }
        else e.Effect = DragDropEffects.None;
    }

    void Drop_DragLeave(object sender, EventArgs e) { ResetBar(); }

    void ResetBar()
    {
        dropBar.BackColor = BarIdle;
        dropLabel.Text = L.T("dropHere");
    }

    void Drop_DragDrop(object sender, DragEventArgs e)
    {
        string[] files = e.Data.GetData(DataFormats.FileDrop) as string[];
        ResetBar();
        if (files == null || files.Length == 0) return;

        PageItem p = cboPage.SelectedItem as PageItem;
        string pageId = p != null ? p.Id : "";

        int ok = 0;
        string last = "";
        foreach (string f in files)
        {
            try
            {
                string r = dropHelper.AddOne(f, pageId);
                last = r;
                if (r.StartsWith("✓")) ok++;
            }
            catch (Exception ex) { last = "HATA: " + ex.Message; }
        }

        dropLabel.Text = files.Length == 1 ? last : (ok + "/" + files.Length + L.T("buttonsAdded"));
        // Birkac saniye sonra normal metne don.
        Timer t = new Timer();
        t.Interval = 2500;
        t.Tick += delegate { t.Stop(); t.Dispose(); ResetBar(); };
        t.Start();
    }

    // ------------------------------------------------------------ sayfalar

    class PageItem
    {
        public string Id;
        public string Name;
        public override string ToString() { return Name; }
    }

    public void LoadPages()
    {
        PageItem cur = cboPage.SelectedItem as PageItem;
        string keep = cur != null ? cur.Id : null;

        cboPage.Items.Clear();
        string json = TrayContext.HttpGet("http://127.0.0.1:" + settings.Port + "/api/pages", 3000);
        if (json != null)
        {
            foreach (System.Text.RegularExpressions.Match m in
                     System.Text.RegularExpressions.Regex.Matches(json,
                         "\\{\\s*\"id\"\\s*:\\s*\"([^\"]*)\"\\s*,\\s*\"name\"\\s*:\\s*\"([^\"]*)\"\\s*\\}"))
            {
                cboPage.Items.Add(new PageItem { Id = m.Groups[1].Value, Name = m.Groups[2].Value });
            }
        }
        if (cboPage.Items.Count == 0) cboPage.Items.Add(new PageItem { Id = "", Name = "(sayfa yok)" });

        int idx = 0;
        if (keep != null)
        {
            for (int i = 0; i < cboPage.Items.Count; i++)
            {
                PageItem p = cboPage.Items[i] as PageItem;
                if (p != null && p.Id == keep) { idx = i; break; }
            }
        }
        cboPage.SelectedIndex = idx;
    }

    public void Reload()
    {
        LoadPages();
        if (webReady) web.CoreWebView2.Reload();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // Kapatma yerine gizle: WebView2'yi her acilista yeniden kurmak yavas.
        if (e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); }
        base.OnFormClosing(e);
    }
}
