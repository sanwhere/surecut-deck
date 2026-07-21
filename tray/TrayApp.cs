// surecut-deck tray - Node host'unu yonetir, durum ve ayarlari sistem tepsisinden sunar.
//
// NOT: Bu dosya .NET Framework'un eski csc.exe'si ile derlenir (C# 5).
// String interpolation ($""), null-conditional (?.), nameof gibi C# 6+ ozellikleri KULLANILAMAZ.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class Program
{
    [STAThread]
    static void Main()
    {
        string[] argv = Environment.GetCommandLineArgs();

        // --drop <yol>: surukle-birakin yaptigi isi komut satirindan calistirir (dogrulama icin).
        // Tek-ornek kilidini atlar, sonucu data\droptest.log'a yazar ve cikar.
        for (int i = 1; i < argv.Length - 1; i++)
        {
            if (argv[i] != "--drop") continue;
            Application.EnableVisualStyles();
            string result;
            try
            {
                DropForm df = new DropForm(HostSettings.Load());
                df.LoadPages();
                result = df.AddOne(argv[i + 1], df.FirstPageId());
            }
            catch (Exception ex) { result = "ISTISNA: " + ex; }
            try
            {
                Directory.CreateDirectory(Paths.Data(""));
                File.WriteAllText(Paths.Data("droptest.log"), result, new UTF8Encoding(false));
            }
            catch { }
            return;
        }

        bool isNew;
        using (Mutex mtx = new Mutex(true, "surecut-deck-tray", out isNew))
        {
            if (!isNew)
            {
                MessageBox.Show(L.T("alreadyRunning"), "surecut-deck",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            TrayContext ctx = new TrayContext();

            // --info: pencereleri acilista goster (kurulum dogrulamasi icin).
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 1; i < args.Length; i++)
            {
                if (args[i] == "--info") ctx.ShowInfo();
                if (args[i] == "--editor") ctx.ShowEditor();
            }

            Application.Run(ctx);
        }
    }
}

// ---------------------------------------------------------------- ayarlar

class HostSettings
{
    public int Port = 8791;
    public bool StartMinimized = true;

    static string IniPath { get { return Paths.Data("host.ini"); } }

    public static HostSettings Load()
    {
        HostSettings s = new HostSettings();
        try
        {
            foreach (string line in File.ReadAllLines(IniPath))
            {
                string t = line.Trim();
                if (t.Length == 0 || t.StartsWith("#")) continue;
                int eq = t.IndexOf('=');
                if (eq < 0) continue;
                string k = t.Substring(0, eq).Trim();
                string v = t.Substring(eq + 1).Trim();
                if (k == "port") { int p; if (int.TryParse(v, out p)) s.Port = p; }
                else if (k == "startMinimized") s.StartMinimized = (v == "1" || v.ToLower() == "true");
            }
        }
        catch { /* dosya yoksa varsayilan */ }
        return s;
    }

    public void Save()
    {
        Directory.CreateDirectory(Paths.Data(""));
        StringBuilder sb = new StringBuilder();
        sb.AppendLine("# surecut-deck host ayarlari");
        sb.AppendLine("port=" + Port);
        sb.AppendLine("startMinimized=" + (StartMinimized ? "1" : "0"));
        File.WriteAllText(IniPath, sb.ToString(), new UTF8Encoding(false));
    }
}

static class Paths
{
    public static string Root
    {
        get
        {
            // exe tray\ altinda durur, proje kokune cik.
            string dir = Path.GetDirectoryName(Application.ExecutablePath);
            DirectoryInfo parent = Directory.GetParent(dir);
            return parent != null ? parent.FullName : dir;
        }
    }
    public static string Data(string name) { return Path.Combine(Path.Combine(Root, "data"), name); }
    public static string ServerJs { get { return Path.Combine(Root, "server.js"); } }
}

// ---------------------------------------------------------------- tray

class TrayContext : ApplicationContext
{
    NotifyIcon tray;
    Process node;
    HostSettings settings;
    readonly List<string> log = new List<string>();
    readonly object logLock = new object();
    LogForm logForm;
    InfoForm infoForm;
    DropForm dropForm;

    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string RunName = "surecut-deck";

    public TrayContext()
    {
        settings = HostSettings.Load();

        tray = new NotifyIcon();
        tray.Icon = MakeIcon(false);
        tray.Text = "surecut-deck";
        tray.Visible = true;
        tray.MouseClick += Tray_MouseClick;
        tray.ContextMenuStrip = BuildMenu();

        StartNode();
    }

    // ------------------------------------------------------------ menu

    ContextMenuStrip BuildMenu()
    {
        ContextMenuStrip m = new ContextMenuStrip();
        m.Opening += delegate { RefreshMenu(m); };
        return m;
    }

    void RefreshMenu(ContextMenuStrip m)
    {
        m.Items.Clear();

        bool running = IsRunning();

        ToolStripMenuItem header = new ToolStripMenuItem(running
            ? L.T("running") + settings.Port
            : L.T("stopped"));
        header.Enabled = false;
        m.Items.Add(header);

        if (running)
        {
            string url = "http://" + PrimaryAddress() + ":" + settings.Port;
            ToolStripMenuItem addr = new ToolStripMenuItem(url);
            addr.Enabled = false;
            m.Items.Add(addr);

            ToolStripMenuItem code = new ToolStripMenuItem(L.T("pairCode") + ReadToken());
            code.Enabled = false;
            m.Items.Add(code);
        }

        m.Items.Add(new ToolStripSeparator());
        ToolStripMenuItem editor = new ToolStripMenuItem(L.T("openEditor"), null, delegate { OpenEditorWindow(); });
        editor.Font = new Font(m.Font, FontStyle.Bold);
        editor.Enabled = running;
        m.Items.Add(editor);

        ToolStripMenuItem drop = new ToolStripMenuItem(L.T("dragDrop"), null, delegate { ShowDrop(); });
        drop.Enabled = running;
        m.Items.Add(drop);

        m.Items.Add(L.T("serverInfo"), null, delegate { ShowInfo(); });
        m.Items.Add(L.T("openInBrowser"), null, delegate { OpenUi(); });
        m.Items.Add(L.T("copyAddress"), null, delegate { CopyUrl(); });
        m.Items.Add(new ToolStripSeparator());
        m.Items.Add(L.T("settings"), null, delegate { ShowSettings(); });
        m.Items.Add(L.T("log"), null, delegate { ShowLog(); });
        m.Items.Add(new ToolStripSeparator());

        if (running)
        {
            m.Items.Add(L.T("restart"), null, delegate { RestartNode(); });
            m.Items.Add(L.T("stop"), null, delegate { StopNode(); UpdateIcon(); });
        }
        else
        {
            m.Items.Add(L.T("start"), null, delegate { StartNode(); });
        }

        m.Items.Add(new ToolStripSeparator());
        m.Items.Add(L.T("quit"), null, delegate { ExitApp(); });
    }

    // ------------------------------------------------------------ tepsi tiklamasi

    DateTime lastTrayClick = DateTime.MinValue;

    void Tray_MouseClick(object sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;

        // Cift tiklamada Click iki kez tetiklenir; ikinci tetigi yut.
        DateTime now = DateTime.Now;
        if ((now - lastTrayClick).TotalMilliseconds < 700) return;
        lastTrayClick = now;

        // Agdan baglanan istemci (tablet) varsa duzenleyiciyi ac,
        // yoksa adres ve eslestirme kodunu goster ki baglanabilesin.
        if (IsRunning() && RemoteClientCount() > 0) OpenEditorWindow();
        else ShowInfo();
    }

    int RemoteClientCount()
    {
        string json = HttpGet("http://127.0.0.1:" + settings.Port + "/api/status", 2000);
        if (json == null) return 0;
        System.Text.RegularExpressions.Match m =
            System.Text.RegularExpressions.Regex.Match(json, "\"remote\"\\s*:\\s*(\\d+)");
        int n;
        return m.Success && int.TryParse(m.Groups[1].Value, out n) ? n : 0;
    }

    public static string HttpGet(string url, int timeoutMs)
    {
        try
        {
            System.Net.HttpWebRequest req = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(url);
            req.Timeout = timeoutMs;
            using (System.Net.WebResponse rs = req.GetResponse())
            using (StreamReader sr = new StreamReader(rs.GetResponseStream(), Encoding.UTF8))
                return sr.ReadToEnd();
        }
        catch { return null; }
    }

    // ------------------------------------------------------------ node sureci

    bool IsRunning()
    {
        try { return node != null && !node.HasExited; }
        catch { return false; }
    }

    void StartNode()
    {
        if (IsRunning()) return;

        if (!File.Exists(Paths.ServerJs))
        {
            AddLog("HATA: server.js bulunamadi: " + Paths.ServerJs);
            UpdateIcon();
            return;
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        // Yaninda bir calisma zamani varsa onu kullan: tasinabilir surumde
        // kullanicinin Node kurmasi gerekmiyor. Yoksa PATH'teki node.exe,
        // yani depodan calistiran gelistirici icin hicbir sey degismiyor.
        string bundled = Path.Combine(Paths.Root, "runtime", "node.exe");
        psi.FileName = File.Exists(bundled) ? bundled : "node.exe";
        psi.Arguments = "\"" + Paths.ServerJs + "\"";
        psi.WorkingDirectory = Paths.Root;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        // Stdin de yonlendiriliyor ama yazmak icin degil: tray oldugunde bu
        // boru kapanir ve host bunu ebeveyninin gittigi anlamina alir. Aksi
        // halde tray zorla oldurulunce node ayakta kaliyor, port bagli kaliyor
        // ve bir sonraki host EADDRINUSE ile dusuyor.
        psi.RedirectStandardInput = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        psi.StandardOutputEncoding = Encoding.UTF8;
        psi.StandardErrorEncoding = Encoding.UTF8;
        psi.EnvironmentVariables["PORT"] = settings.Port.ToString();
        psi.EnvironmentVariables["SURECUT_WATCH_STDIN"] = "1";

        try
        {
            node = new Process();
            node.StartInfo = psi;
            node.EnableRaisingEvents = true;
            node.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) AddLog(e.Data); };
            node.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) AddLog("[err] " + e.Data); };
            node.Exited += delegate { AddLog("--- host durdu ---"); SyncIcon(); };
            node.Start();
            node.BeginOutputReadLine();
            node.BeginErrorReadLine();
            AddLog("--- host baslatildi (port " + settings.Port + ") ---");
        }
        catch (Exception ex)
        {
            node = null;
            AddLog("HATA: node baslatilamadi: " + ex.Message);
            MessageBox.Show(
                L.T("nodeFailed") + ex.Message +
                L.T("nodeFailedHint"),
                "surecut-deck", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }

        UpdateIcon();
    }

    void StopNode()
    {
        if (node == null) return;
        try { if (!node.HasExited) { node.Kill(); node.WaitForExit(3000); } }
        catch { /* zaten olmus olabilir */ }
        node = null;
    }

    void RestartNode()
    {
        StopNode();
        Thread.Sleep(400);
        StartNode();
    }

    // Exited olayi arka plan is parcaciginda gelir; UI'a marshal et.
    void SyncIcon()
    {
        if (tray == null) return;
        try
        {
            if (logForm != null && logForm.IsHandleCreated)
                logForm.BeginInvoke((MethodInvoker)delegate { UpdateIcon(); });
            else
                UpdateIcon();
        }
        catch { }
    }

    void UpdateIcon()
    {
        bool r = IsRunning();
        tray.Icon = MakeIcon(r);
        tray.Text = r
            ? L.T("trayRunning") + settings.Port + ")"
            : L.T("trayStopped");
    }

    // ------------------------------------------------------------ gunluk

    void AddLog(string line)
    {
        string stamped = DateTime.Now.ToString("HH:mm:ss") + "  " + line;
        lock (logLock)
        {
            log.Add(stamped);
            if (log.Count > 500) log.RemoveRange(0, log.Count - 500);
        }
        // Dosyaya da yaz: tray penceresi acilmadan da tani yapilabilsin.
        try
        {
            Directory.CreateDirectory(Paths.Data(""));
            File.AppendAllText(Paths.Data("tray.log"), stamped + Environment.NewLine, new UTF8Encoding(false));
        }
        catch { }
        if (logForm != null && logForm.IsHandleCreated)
        {
            try { logForm.BeginInvoke((MethodInvoker)delegate { logForm.Append(stamped); }); }
            catch { }
        }
    }

    public string[] LogSnapshot()
    {
        lock (logLock) { return log.ToArray(); }
    }

    // ------------------------------------------------------------ yardimcilar

    public static string ReadToken()
    {
        try { return File.ReadAllText(Paths.Data("token.txt")).Trim(); }
        catch { return L.T("notGenerated"); }
    }

    public static void RegenerateToken()
    {
        byte[] b = new byte[4];
        using (System.Security.Cryptography.RandomNumberGenerator rng =
               System.Security.Cryptography.RandomNumberGenerator.Create())
        {
            rng.GetBytes(b);
        }
        string tok = BitConverter.ToString(b).Replace("-", "").ToUpperInvariant();
        Directory.CreateDirectory(Paths.Data(""));
        File.WriteAllText(Paths.Data("token.txt"), tok, new UTF8Encoding(false));
    }

    public static List<string[]> LocalAddresses()
    {
        List<string[]> list = new List<string[]>();
        try
        {
            foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                foreach (UnicastIPAddressInformation ua in ni.GetIPProperties().UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    list.Add(new string[] { ua.Address.ToString(), ni.Name });
                }
            }
        }
        catch { }
        return list;
    }

    // Ev agi adresini one cikar: 192.168.x tercih edilir, yoksa ilk adres.
    public static string PrimaryAddress()
    {
        List<string[]> all = LocalAddresses();
        foreach (string[] a in all) if (a[0].StartsWith("192.168.")) return a[0];
        foreach (string[] a in all) if (a[0].StartsWith("10.") || a[0].StartsWith("172.")) return a[0];
        return all.Count > 0 ? all[0][0] : "127.0.0.1";
    }

    // Duzenleyiciyi tarayicinin "uygulama penceresi" modunda acar: sekme/adres cubugu
    // olmadan, native pencere gibi gorunur. Ayni web arayuzu oldugu icin tabletle
    // birebir ayni ozellikler, ve degisiklikler aninda tablete yayilir.
    EditorForm editorForm;

    // Duzenleyici artik NATIVE bir pencere: web arayuzunu WebView2 icinde barindirir.
    // Boylece masaustunden birakilan kisayolun gercek yolu alinabiliyor - tarayici
    // penceresinde bu mumkun degildi.
    public void ShowEditor() { OpenEditorWindow(); }

    void OpenEditorWindow()
    {
        try
        {
            if (editorForm == null || editorForm.IsDisposed)
            {
                if (dropForm == null || dropForm.IsDisposed) dropForm = new DropForm(settings);
                editorForm = new EditorForm(settings, dropForm);
            }
            else editorForm.Reload();

            editorForm.Show();
            if (editorForm.WindowState == FormWindowState.Minimized)
                editorForm.WindowState = FormWindowState.Normal;
            editorForm.BringToFront();
            editorForm.Activate();
            return;
        }
        catch (Exception ex)
        {
            AddLog("[editor] native pencere acilamadi: " + ex);
            // Sessizce tarayiciya dusup kullaniciyi "neden boyle" diye birakma.
            if (!editorFallbackWarned)
            {
                editorFallbackWarned = true;
                tray.ShowBalloonTip(4000, "surecut-deck",
                    L.T("editorFellBack"),
                    ToolTipIcon.Warning);
            }
            OpenEditorInBrowser();
        }
    }

    bool editorFallbackWarned;
    Process browserEditorProc;

    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);

    void OpenEditorInBrowser()
    {
        // Yedek yolda da tek pencere: her tiklamada yeni tarayici penceresi acilmasin.
        try
        {
            if (browserEditorProc != null && !browserEditorProc.HasExited)
            {
                browserEditorProc.Refresh();
                IntPtr h = browserEditorProc.MainWindowHandle;
                if (h != IntPtr.Zero)
                {
                    if (IsIconic(h)) ShowWindow(h, 9);
                    SetForegroundWindow(h);
                    return;
                }
            }
        }
        catch { /* surec olmus olabilir, asagida yenisi acilir */ }

        string url = "http://127.0.0.1:" + settings.Port + "/";
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        string[] browsers = new string[] {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe")
        };

        foreach (string exe in browsers)
        {
            if (!File.Exists(exe)) continue;
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = exe;
                psi.Arguments = "--app=" + url + " --window-size=1180,780";
                psi.UseShellExecute = false;
                browserEditorProc = Process.Start(psi);
                return;
            }
            catch { /* sonrakini dene */ }
        }

        // Edge/Chrome bulunamadi: varsayilan tarayicida ac.
        OpenUi();
    }

    void OpenUi()
    {
        try { Process.Start("http://127.0.0.1:" + settings.Port); }
        catch (Exception ex) { MessageBox.Show(ex.Message, "surecut-deck"); }
    }

    void CopyUrl()
    {
        string url = "http://" + PrimaryAddress() + ":" + settings.Port;
        try
        {
            Clipboard.SetText(url);
            tray.ShowBalloonTip(2000, "surecut-deck", L.T("copied") + url, ToolTipIcon.Info);
        }
        catch { }
    }

    // ------------------------------------------------------------ pencereler

    public void ShowInfo()
    {
        if (infoForm == null || infoForm.IsDisposed)
            infoForm = new InfoForm(this, settings);
        infoForm.Refresh2();
        infoForm.Show();
        infoForm.BringToFront();
        infoForm.Activate();
    }

    void ShowDrop()
    {
        if (dropForm == null || dropForm.IsDisposed)
            dropForm = new DropForm(settings);
        dropForm.LoadPages();
        dropForm.Show();
        dropForm.BringToFront();
        dropForm.Activate();
    }

    void ShowLog()
    {
        if (logForm == null || logForm.IsDisposed)
        {
            logForm = new LogForm();
            logForm.SetLines(LogSnapshot());
        }
        logForm.Show();
        logForm.BringToFront();
        logForm.Activate();
    }

    void ShowSettings()
    {
        using (SettingsForm f = new SettingsForm(settings, IsAutoStart()))
        {
            if (f.ShowDialog() != DialogResult.OK) return;

            bool portChanged = settings.Port != f.ResultPort;
            settings.Port = f.ResultPort;
            settings.StartMinimized = f.ResultStartMinimized;
            settings.Save();
            SetAutoStart(f.ResultAutoStart);

            if (f.ResultRegenerate)
            {
                RegenerateToken();
                MessageBox.Show(
                    L.T("newCode") + ReadToken() +
                    L.T("newCodeHint"),
                    "surecut-deck", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            if (portChanged || f.ResultRegenerate) RestartNode();
            UpdateIcon();
            if (infoForm != null && !infoForm.IsDisposed) infoForm.Refresh2();
        }
    }

    // ------------------------------------------------------------ otomatik baslatma

    public static bool IsAutoStart()
    {
        try
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
            {
                if (k == null) return false;
                return k.GetValue(RunName) != null;
            }
        }
        catch { return false; }
    }

    public static void SetAutoStart(bool on)
    {
        try
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey, true))
            {
                if (k == null) return;
                if (on) k.SetValue(RunName, "\"" + Application.ExecutablePath + "\"");
                else if (k.GetValue(RunName) != null) k.DeleteValue(RunName);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(L.T("autoStartFailed") + ex.Message, "surecut-deck");
        }
    }

    // ------------------------------------------------------------ ikon

    // Ikonu kod icinde ciz; ayri .ico dosyasi tasimaya gerek kalmasin.
    static Icon MakeIcon(bool running)
    {
        using (Bitmap bmp = new Bitmap(32, 32))
        {
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                Color[] cols = running
                    ? new Color[] { Color.FromArgb(59, 130, 246), Color.FromArgb(34, 197, 94),
                                    Color.FromArgb(245, 158, 11), Color.FromArgb(168, 85, 247) }
                    : new Color[] { Color.FromArgb(90, 90, 96), Color.FromArgb(90, 90, 96),
                                    Color.FromArgb(90, 90, 96), Color.FromArgb(90, 90, 96) };

                int[][] boxes = new int[][] {
                    new int[]{2,2}, new int[]{17,2}, new int[]{2,17}, new int[]{17,17}
                };
                for (int i = 0; i < 4; i++)
                {
                    using (SolidBrush b = new SolidBrush(cols[i]))
                        g.FillRectangle(b, boxes[i][0], boxes[i][1], 13, 13);
                }
            }
            return Icon.FromHandle(bmp.GetHicon());
        }
    }

    // ------------------------------------------------------------ cikis

    void ExitApp()
    {
        StopNode();
        tray.Visible = false;
        tray.Dispose();
        Application.Exit();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { StopNode(); if (tray != null) { tray.Visible = false; tray.Dispose(); } }
        base.Dispose(disposing);
    }
}

// ---------------------------------------------------------------- surukle-birak

// Masaustunden surukelenen kisayol/program icin hedefi, argumanlari ve ikonu cikarir.
static class ShortcutInfo
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHDefExtractIconW(string pszIconFile, int iIndex, uint uFlags,
        out IntPtr phiconLarge, out IntPtr phiconSmall, uint nIconSize);

    [DllImport("user32.dll")]
    static extern bool DestroyIcon(IntPtr hIcon);

    public class Info
    {
        public string Label;
        public string Target;
        public string Args;
        public string IconSource;
        public int IconIndex;
        public bool IsFolderOrDoc;
    }

    public static Info Parse(string path)
    {
        Info inf = new Info();
        inf.Label = Path.GetFileNameWithoutExtension(path);
        inf.Target = path;
        inf.Args = "";
        inf.IconSource = path;
        inf.IconIndex = 0;

        if (path.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase))
        {
            // WScript.Shell'i gec baglama ile kullan: derleme zamani COM referansi gerekmez.
            object shell = null;
            try
            {
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                if (t != null)
                {
                    shell = Activator.CreateInstance(t);
                    object sc = t.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod,
                        null, shell, new object[] { path });
                    Type st = sc.GetType();

                    string target = (string)st.InvokeMember("TargetPath", System.Reflection.BindingFlags.GetProperty, null, sc, null);
                    string args = (string)st.InvokeMember("Arguments", System.Reflection.BindingFlags.GetProperty, null, sc, null);
                    string iconLoc = (string)st.InvokeMember("IconLocation", System.Reflection.BindingFlags.GetProperty, null, sc, null);

                    if (!string.IsNullOrEmpty(target)) inf.Target = target;
                    inf.Args = args ?? "";

                    // IconLocation "yol,index" bicimindedir; bos veya ",0" ise hedefin ikonunu kullan.
                    inf.IconSource = inf.Target;
                    if (!string.IsNullOrEmpty(iconLoc))
                    {
                        int comma = iconLoc.LastIndexOf(',');
                        string file = comma > 1 ? iconLoc.Substring(0, comma) : iconLoc;
                        int idx = 0;
                        if (comma > 1) int.TryParse(iconLoc.Substring(comma + 1), out idx);
                        if (!string.IsNullOrEmpty(file) && File.Exists(file))
                        {
                            inf.IconSource = file;
                            inf.IconIndex = idx;
                        }
                    }
                }
            }
            catch { /* cozulemezse .lnk'in kendisi hedef kalir, Windows yine acar */ }
            finally
            {
                if (shell != null && Marshal.IsComObject(shell)) Marshal.ReleaseComObject(shell);
            }
        }

        inf.IsFolderOrDoc = Directory.Exists(inf.Target) ||
            (!inf.Target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(inf.Target));

        return inf;
    }

    // Buyuk ikonu cikar. SHDefExtractIcon istenen boyutu verebildigi icin
    // ExtractAssociatedIcon'un sabit 32px'inden daha net sonuc verir.
    public static Bitmap ExtractIcon(string file, int index, int size)
    {
        IntPtr large = IntPtr.Zero, small = IntPtr.Zero;
        try
        {
            int hr = SHDefExtractIconW(file, index, 0, out large, out small, (uint)size);
            IntPtr h = large != IntPtr.Zero ? large : small;
            if (hr == 0 && h != IntPtr.Zero)
            {
                using (Icon ic = Icon.FromHandle(h))
                    return ic.ToBitmap();
            }
        }
        catch { }
        finally
        {
            if (large != IntPtr.Zero) DestroyIcon(large);
            if (small != IntPtr.Zero) DestroyIcon(small);
        }

        try
        {
            using (Icon ic = Icon.ExtractAssociatedIcon(file))
                if (ic != null) return ic.ToBitmap();
        }
        catch { }

        return null;
    }
}

class DropForm : Form
{
    readonly HostSettings settings;
    ComboBox cboPage;
    Panel zone;
    Label zoneText;
    ListBox added;

    public DropForm(HostSettings s)
    {
        settings = s;

        Text = L.T("dropTitle");
        L.ApplyRtl(this);
        // Yonetici olarak calisirken surukle birak icin, bkz. Uipi.cs
        HandleCreated += delegate { Uipi.AllowDrops(Handle); };
        Size = new Size(440, 460);
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        Font = new Font("Segoe UI", 9f);
        TopMost = true;

        Label l1 = new Label();
        l1.Text = L.T("whichPage");
        l1.Location = new Point(16, 14);
        l1.Size = new Size(250, 18);
        l1.ForeColor = Color.Gray;
        Controls.Add(l1);

        cboPage = new ComboBox();
        cboPage.Location = new Point(16, 34);
        cboPage.Size = new Size(280, 24);
        cboPage.DropDownStyle = ComboBoxStyle.DropDownList;
        // Liste her acilista tazelensin: kullanici tabletten yeni sayfa
        // ekledikten sonra burada gorunmuyordu ve o sayfaya buton eklenemiyordu.
        cboPage.DropDown += delegate { LoadPages(); };
        Controls.Add(cboPage);

        Button bReload = new Button();
        bReload.Text = L.T("refresh");
        bReload.Location = new Point(304, 33);
        bReload.Size = new Size(100, 26);
        bReload.Click += delegate { LoadPages(); };
        Controls.Add(bReload);

        zone = new Panel();
        zone.Location = new Point(16, 74);
        zone.Size = new Size(388, 170);
        zone.BackColor = Color.FromArgb(245, 247, 250);
        zone.BorderStyle = BorderStyle.FixedSingle;
        zone.AllowDrop = true;
        zone.DragEnter += Zone_DragEnter;
        zone.DragLeave += delegate { zone.BackColor = Color.FromArgb(245, 247, 250); };
        zone.DragDrop += Zone_DragDrop;
        Controls.Add(zone);

        zoneText = new Label();
        zoneText.Text = L.T("dropZone");
        zoneText.Dock = DockStyle.Fill;
        zoneText.TextAlign = ContentAlignment.MiddleCenter;
        zoneText.ForeColor = Color.FromArgb(110, 115, 125);
        zoneText.Font = new Font("Segoe UI", 10f);
        zoneText.AllowDrop = true;
        // Etiket panelin tamamini kapladigi icin surukleme olaylarini o da almali.
        zoneText.DragEnter += Zone_DragEnter;
        zoneText.DragLeave += delegate { zone.BackColor = Color.FromArgb(245, 247, 250); };
        zoneText.DragDrop += Zone_DragDrop;
        zone.Controls.Add(zoneText);

        Label l2 = new Label();
        l2.Text = L.T("added");
        l2.Location = new Point(16, 256);
        l2.Size = new Size(250, 18);
        l2.ForeColor = Color.Gray;
        Controls.Add(l2);

        added = new ListBox();
        added.Location = new Point(16, 276);
        added.Size = new Size(388, 100);
        Controls.Add(added);

        CheckBox chkTop = new CheckBox();
        chkTop.Text = L.T("alwaysOnTop");
        chkTop.Location = new Point(16, 386);
        chkTop.Size = new Size(160, 24);
        chkTop.Checked = true;
        chkTop.CheckedChanged += delegate { TopMost = chkTop.Checked; };
        Controls.Add(chkTop);

        Button bClose = new Button();
        bClose.Text = L.T("close");
        bClose.Location = new Point(304, 384);
        bClose.Size = new Size(100, 30);
        bClose.Click += delegate { Hide(); };
        Controls.Add(bClose);

        LoadPages();
    }

    void Zone_DragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            e.Effect = DragDropEffects.Copy;
            zone.BackColor = Color.FromArgb(214, 234, 255);
        }
        else e.Effect = DragDropEffects.None;
    }

    void Zone_DragDrop(object sender, DragEventArgs e)
    {
        zone.BackColor = Color.FromArgb(245, 247, 250);
        string[] files = e.Data.GetData(DataFormats.FileDrop) as string[];
        if (files == null) return;

        string pageId = SelectedPageId();
        foreach (string f in files)
        {
            string r;
            try { r = AddOne(f, pageId); }
            catch (Exception ex) { r = "HATA " + Path.GetFileName(f) + ": " + ex.Message; }
            added.Items.Insert(0, r);
        }
    }

    public string FirstPageId()
    {
        PageItem p = cboPage.Items.Count > 0 ? cboPage.Items[0] as PageItem : null;
        return p != null ? p.Id : "";
    }

    string SelectedPageId()
    {
        PageItem p = cboPage.SelectedItem as PageItem;
        return p != null ? p.Id : "";
    }

    public string AddOne(string path, string pageId)
    {
        ShortcutInfo.Info inf = ShortcutInfo.Parse(path);

        // Ikonu cikar ve public/icons altina yaz; sunucu oradan servis eder.
        string iconUrl = null;
        Bitmap bmp = ShortcutInfo.ExtractIcon(inf.IconSource, inf.IconIndex, 128);
        if (bmp == null) bmp = ShortcutInfo.ExtractIcon(path, 0, 128);
        if (bmp != null)
        {
            using (bmp)
            {
                string dir = Path.Combine(Path.Combine(Paths.Root, "public"), "icons");
                Directory.CreateDirectory(dir);
                string name = Slug(inf.Label) + "-" + Math.Abs(inf.Target.GetHashCode()).ToString("x") + ".png";
                bmp.Save(Path.Combine(dir, name), System.Drawing.Imaging.ImageFormat.Png);
                iconUrl = "icons/" + name;
            }
        }

        string json =
            "{\"pageId\":" + Js(pageId) +
            ",\"label\":" + Js(inf.Label) +
            (iconUrl != null ? ",\"iconUrl\":" + Js(iconUrl) : "") +
            ",\"color\":\"#3b82f6\"" +
            ",\"action\":{\"type\":\"launch\",\"target\":" + Js(inf.Target) +
            (string.IsNullOrEmpty(inf.Args) ? "" : ",\"args\":" + Js(inf.Args)) + "}}";

        string resp = PostJson("http://127.0.0.1:" + settings.Port + "/api/button", json);
        return resp.Contains("\"ok\":true")
            ? "✓  " + inf.Label + (iconUrl != null ? L.T("iconYes") : L.T("iconNo"))
            : "HATA  " + inf.Label + ": " + resp;
    }

    static string Slug(string s)
    {
        StringBuilder sb = new StringBuilder();
        foreach (char c in s.ToLowerInvariant())
            sb.Append((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '-');
        string r = sb.ToString().Trim('-');
        return r.Length == 0 ? "icon" : (r.Length > 32 ? r.Substring(0, 32) : r);
    }

    // Minimal JSON string kacisi.
    static string Js(string s)
    {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < 32 || c > 126) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append("\"").ToString();
    }

    static string PostJson(string url, string body)
    {
        try
        {
            System.Net.HttpWebRequest req = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json; charset=utf-8";
            req.Timeout = 8000;
            byte[] data = Encoding.UTF8.GetBytes(body);
            req.ContentLength = data.Length;
            using (Stream st = req.GetRequestStream()) st.Write(data, 0, data.Length);
            using (System.Net.WebResponse rs = req.GetResponse())
            using (StreamReader sr = new StreamReader(rs.GetResponseStream(), Encoding.UTF8))
                return sr.ReadToEnd();
        }
        catch (Exception ex) { return ex.Message; }
    }

    static string GetJson(string url)
    {
        try
        {
            System.Net.HttpWebRequest req = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(url);
            req.Timeout = 5000;
            using (System.Net.WebResponse rs = req.GetResponse())
            using (StreamReader sr = new StreamReader(rs.GetResponseStream(), Encoding.UTF8))
                return sr.ReadToEnd();
        }
        catch { return null; }
    }

    class PageItem
    {
        public string Id;
        public string Name;
        public override string ToString() { return Name; }
    }

    public void LoadPages()
    {
        // Secili sayfayi koru: liste her acilista yeniden yukleniyor.
        PageItem cur = cboPage.SelectedItem as PageItem;
        string keep = cur != null ? cur.Id : null;

        cboPage.Items.Clear();
        string json = GetJson("http://127.0.0.1:" + settings.Port + "/api/pages");
        if (json == null)
        {
            cboPage.Items.Add(new PageItem { Id = "", Name = L.T("hostNotRunning") });
            cboPage.SelectedIndex = 0;
            return;
        }

        // {"ok":true,"pages":[{"id":"main","name":"Ana"},...]}
        foreach (System.Text.RegularExpressions.Match m in
                 System.Text.RegularExpressions.Regex.Matches(json,
                     "\\{\\s*\"id\"\\s*:\\s*\"([^\"]*)\"\\s*,\\s*\"name\"\\s*:\\s*\"([^\"]*)\"\\s*\\}"))
        {
            cboPage.Items.Add(new PageItem { Id = m.Groups[1].Value, Name = m.Groups[2].Value });
        }

        if (cboPage.Items.Count == 0)
            cboPage.Items.Add(new PageItem { Id = "", Name = "(sayfa yok)" });

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

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); }
        base.OnFormClosing(e);
    }
}

// ---------------------------------------------------------------- bilgi penceresi

class InfoForm : Form
{
    readonly TrayContext ctx;
    readonly HostSettings settings;
    Label lblStatus, lblCode;
    ListView lvAddr;

    public InfoForm(TrayContext c, HostSettings s)
    {
        ctx = c; settings = s;

        Text = L.T("infoTitle");
        L.ApplyRtl(this);
        Size = new Size(520, 420);
        StartPosition = FormStartPosition.CenterScreen;
        MinimizeBox = false;
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        Font = new Font("Segoe UI", 9f);

        lblStatus = new Label();
        lblStatus.Location = new Point(16, 14);
        lblStatus.Size = new Size(470, 24);
        lblStatus.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
        Controls.Add(lblStatus);

        Label l1 = new Label();
        l1.Text = L.T("pairCodeLabel");
        l1.Location = new Point(16, 48);
        l1.Size = new Size(200, 18);
        l1.ForeColor = Color.Gray;
        Controls.Add(l1);

        lblCode = new Label();
        lblCode.Location = new Point(16, 66);
        lblCode.Size = new Size(300, 34);
        lblCode.Font = new Font("Consolas", 18f, FontStyle.Bold);
        Controls.Add(lblCode);

        Button bCopyCode = new Button();
        bCopyCode.Text = L.T("copyCode");
        bCopyCode.Location = new Point(330, 68);
        bCopyCode.Size = new Size(150, 30);
        bCopyCode.Click += delegate
        {
            try { Clipboard.SetText(TrayContext.ReadToken()); } catch { }
        };
        Controls.Add(bCopyCode);

        Label l2 = new Label();
        l2.Text = L.T("addressHint");
        l2.Location = new Point(16, 112);
        l2.Size = new Size(470, 18);
        l2.ForeColor = Color.Gray;
        Controls.Add(l2);

        lvAddr = new ListView();
        lvAddr.Location = new Point(16, 134);
        lvAddr.Size = new Size(468, 180);
        lvAddr.View = View.Details;
        lvAddr.FullRowSelect = true;
        lvAddr.MultiSelect = false;
        lvAddr.Columns.Add(L.T("colAddress"), 250);
        lvAddr.Columns.Add(L.T("colInterface"), 200);
        lvAddr.DoubleClick += delegate
        {
            if (lvAddr.SelectedItems.Count == 0) return;
            try { Clipboard.SetText(lvAddr.SelectedItems[0].Text); } catch { }
        };
        Controls.Add(lvAddr);

        Button bRefresh = new Button();
        bRefresh.Text = L.T("refresh");
        bRefresh.Location = new Point(16, 326);
        bRefresh.Size = new Size(110, 32);
        bRefresh.Click += delegate { Refresh2(); };
        Controls.Add(bRefresh);

        Button bClose = new Button();
        bClose.Text = L.T("close");
        bClose.Location = new Point(374, 326);
        bClose.Size = new Size(110, 32);
        bClose.Click += delegate { Hide(); };
        Controls.Add(bClose);
    }

    public void Refresh2()
    {
        lblCode.Text = TrayContext.ReadToken();
        lblStatus.Text = L.T("port") + " " + settings.Port;

        lvAddr.Items.Clear();
        foreach (string[] a in TrayContext.LocalAddresses())
        {
            ListViewItem it = new ListViewItem("http://" + a[0] + ":" + settings.Port);
            it.SubItems.Add(a[1]);
            lvAddr.Items.Add(it);
        }
    }

    // Kapatma yerine gizle; tray uygulamasi acik kalsin.
    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); }
        base.OnFormClosing(e);
    }
}

// ---------------------------------------------------------------- ayarlar penceresi

class SettingsForm : Form
{
    NumericUpDown numPort;
    CheckBox chkAutoStart, chkMinimized, chkRegen;

    public int ResultPort;
    public bool ResultAutoStart, ResultStartMinimized, ResultRegenerate;

    public SettingsForm(HostSettings s, bool autoStart)
    {
        Text = L.T("settingsTitle");
        L.ApplyRtl(this);
        Size = new Size(460, 340);
        StartPosition = FormStartPosition.CenterScreen;
        MinimizeBox = false;
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        Font = new Font("Segoe UI", 9f);

        Label lPort = new Label();
        lPort.Text = L.T("port");
        lPort.Location = new Point(18, 20);
        lPort.Size = new Size(120, 20);
        Controls.Add(lPort);

        numPort = new NumericUpDown();
        numPort.Location = new Point(18, 42);
        numPort.Size = new Size(120, 24);
        numPort.Minimum = 1024;
        numPort.Maximum = 65535;
        numPort.Value = s.Port;
        Controls.Add(numPort);

        Label lHint = new Label();
        lHint.Text = L.T("portHint");
        lHint.Location = new Point(150, 46);
        lHint.Size = new Size(280, 34);
        lHint.ForeColor = Color.Gray;
        Controls.Add(lHint);

        chkAutoStart = new CheckBox();
        chkAutoStart.Text = L.T("startWithWindows");
        chkAutoStart.Location = new Point(18, 88);
        chkAutoStart.Size = new Size(400, 24);
        chkAutoStart.Checked = autoStart;
        Controls.Add(chkAutoStart);

        chkMinimized = new CheckBox();
        chkMinimized.Text = L.T("startMinimized");
        chkMinimized.Location = new Point(18, 116);
        chkMinimized.Size = new Size(400, 24);
        chkMinimized.Checked = s.StartMinimized;
        Controls.Add(chkMinimized);

        chkRegen = new CheckBox();
        chkRegen.Text = L.T("regenCode");
        chkRegen.Location = new Point(18, 152);
        chkRegen.Size = new Size(400, 24);
        chkRegen.ForeColor = Color.FromArgb(180, 60, 60);
        Controls.Add(chkRegen);

        Label lRegen = new Label();
        lRegen.Text = L.T("regenHint");
        lRegen.Location = new Point(38, 176);
        lRegen.Size = new Size(390, 20);
        lRegen.ForeColor = Color.Gray;
        Controls.Add(lRegen);

        Button bFw = new Button();
        bFw.Text = L.T("addFirewall");
        bFw.Location = new Point(18, 206);
        bFw.Size = new Size(410, 32);
        bFw.Click += delegate { AddFirewallRule((int)numPort.Value); };
        Controls.Add(bFw);

        Button bOk = new Button();
        bOk.Text = L.T("save");
        bOk.Location = new Point(228, 254);
        bOk.Size = new Size(95, 32);
        bOk.Click += delegate
        {
            ResultPort = (int)numPort.Value;
            ResultAutoStart = chkAutoStart.Checked;
            ResultStartMinimized = chkMinimized.Checked;
            ResultRegenerate = chkRegen.Checked;
            DialogResult = DialogResult.OK;
            Close();
        };
        Controls.Add(bOk);
        AcceptButton = bOk;

        Button bCancel = new Button();
        bCancel.Text = L.T("cancel");
        bCancel.Location = new Point(333, 254);
        bCancel.Size = new Size(95, 32);
        bCancel.Click += delegate { DialogResult = DialogResult.Cancel; Close(); };
        Controls.Add(bCancel);
        CancelButton = bCancel;
    }

    static void AddFirewallRule(int port)
    {
        string cmd =
            "Remove-NetFirewallRule -DisplayName 'surecut-deck' -ErrorAction SilentlyContinue; " +
            "New-NetFirewallRule -DisplayName 'surecut-deck' -Direction Inbound -Protocol TCP " +
            "-LocalPort " + port + " -Action Allow -Profile Private";
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command \"" + cmd + "\"";
            psi.Verb = "runas";               // yonetici yukseltmesi iste
            psi.UseShellExecute = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process p = Process.Start(psi);
            p.WaitForExit(15000);
            MessageBox.Show(p.ExitCode == 0
                ? L.T("firewallAdded") + port + L.T("firewallAddedTail")
                : L.T("firewallFailed"),
                "surecut-deck");
        }
        catch (Exception ex)
        {
            // Kullanici UAC'yi reddederse buraya duser.
            MessageBox.Show(L.T("firewallError") + ex.Message, "surecut-deck");
        }
    }
}

// ---------------------------------------------------------------- gunluk penceresi

class LogForm : Form
{
    TextBox box;

    public LogForm()
    {
        Text = L.T("logTitle");
        L.ApplyRtl(this);
        Size = new Size(760, 460);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9f);

        box = new TextBox();
        box.Multiline = true;
        box.ReadOnly = true;
        box.ScrollBars = ScrollBars.Both;
        box.WordWrap = false;
        box.Dock = DockStyle.Fill;
        box.BackColor = Color.FromArgb(28, 28, 31);
        box.ForeColor = Color.FromArgb(230, 230, 235);
        box.Font = new Font("Consolas", 9f);
        box.BorderStyle = BorderStyle.None;
        Controls.Add(box);
    }

    public void SetLines(string[] lines)
    {
        box.Text = string.Join("\r\n", lines);
        ScrollToEnd();
    }

    public void Append(string line)
    {
        box.AppendText((box.TextLength > 0 ? "\r\n" : "") + line);
        ScrollToEnd();
    }

    void ScrollToEnd()
    {
        box.SelectionStart = box.TextLength;
        box.ScrollToCaret();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); }
        base.OnFormClosing(e);
    }
}
