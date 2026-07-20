// InputHelper - stdin uzerinden komut alip Win32 SendInput ile klavye olayi ureten yardimci.
// Uzun omurlu calisir; her tus icin process acmanin ~50ms gecikmesini onler.
//
// Protokol (satir bazli, UTF-8):
//   KEY <kombinasyon>   ornek: KEY ctrl+shift+esc  |  KEY volumeup  |  KEY win+d
//   TEXT <metin>        ornek: TEXT merhaba dunya
//   MMOVE <dx> <dy>     goreli fare hareketi (piksel)
//   MCLICK <btn>        left|right|middle  - bas ve birak
//   MDOWN <btn>         basili tut (surukleme icin)
//   MUP <btn>           birak
//   MSCROLL <miktar>    dikey tekerlek, 1 = bir centik
//   MHSCROLL <miktar>   yatay tekerlek
//   PING
// Her komuta tek satir yanit: OK / ERR <mesaj> / PONG

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

static class InputHelper
{
    const int INPUT_MOUSE = 0;
    const int INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint MOUSEEVENTF_HWHEEL = 0x1000;
    const int WHEEL_DELTA = 120;

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion U; }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    // Sag/sol ayrimi olan veya numpad disi olan tuslar EXTENDEDKEY bayragi ister.
    static readonly HashSet<ushort> Extended = new HashSet<ushort>
    {
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, // PgUp/PgDn/End/Home/oklar
        0x2D, 0x2E, 0x2C, 0x90, 0x6F, 0x0D,             // Insert/Delete/PrintScreen/NumLock/Divide
        0x5B, 0x5C, 0x5D,                               // Win tuslari, Menu
        0xA3, 0xA5,                                     // Sag Ctrl, Sag Alt
        0xAD, 0xAE, 0xAF, 0xB0, 0xB1, 0xB2, 0xB3        // Medya tuslari
    };

    static readonly Dictionary<string, ushort> Vk = new Dictionary<string, ushort>(StringComparer.OrdinalIgnoreCase)
    {
        {"ctrl",0xA2},{"control",0xA2},{"lctrl",0xA2},{"rctrl",0xA3},
        {"alt",0xA4},{"lalt",0xA4},{"ralt",0xA5},
        {"shift",0xA0},{"lshift",0xA0},{"rshift",0xA1},
        {"win",0x5B},{"lwin",0x5B},{"rwin",0x5C},{"meta",0x5B},{"cmd",0x5B},
        {"enter",0x0D},{"return",0x0D},{"esc",0x1B},{"escape",0x1B},
        {"tab",0x09},{"space",0x20},{"backspace",0x08},{"bs",0x08},
        {"delete",0x2E},{"del",0x2E},{"insert",0x2D},{"ins",0x2D},
        {"home",0x24},{"end",0x23},{"pageup",0x21},{"pgup",0x21},
        {"pagedown",0x22},{"pgdn",0x22},
        {"up",0x26},{"down",0x28},{"left",0x25},{"right",0x27},
        {"capslock",0x14},{"numlock",0x90},{"scrolllock",0x91},
        {"printscreen",0x2C},{"prtsc",0x2C},{"pause",0x13},{"menu",0x5D},{"apps",0x5D},
        {"f1",0x70},{"f2",0x71},{"f3",0x72},{"f4",0x73},{"f5",0x74},{"f6",0x75},
        {"f7",0x76},{"f8",0x77},{"f9",0x78},{"f10",0x79},{"f11",0x7A},{"f12",0x7B},
        {"f13",0x7C},{"f14",0x7D},{"f15",0x7E},{"f16",0x7F},
        // Medya ve ses
        {"volumeup",0xAF},{"volup",0xAF},{"volumedown",0xAE},{"voldown",0xAE},
        {"volumemute",0xAD},{"mute",0xAD},
        {"playpause",0xB3},{"play",0xB3},{"pause_media",0xB3},
        {"nexttrack",0xB0},{"next",0xB0},{"prevtrack",0xB1},{"prev",0xB1},
        {"stop",0xB2},
        {"browserback",0xA6},{"browserforward",0xA7},{"browserrefresh",0xA8},
        {"browserhome",0xAC},{"browsersearch",0xAA},
        {"launchmail",0xB4},{"launchmedia",0xB5},
        // Numpad
        {"num0",0x60},{"num1",0x61},{"num2",0x62},{"num3",0x63},{"num4",0x64},
        {"num5",0x65},{"num6",0x66},{"num7",0x67},{"num8",0x68},{"num9",0x69},
        {"multiply",0x6A},{"add",0x6B},{"subtract",0x6D},{"decimal",0x6E},{"divide",0x6F},
        // Noktalama
        {"semicolon",0xBA},{";",0xBA},{"equals",0xBB},{"=",0xBB},{"comma",0xBC},{",",0xBC},
        {"minus",0xBD},{"-",0xBD},{"period",0xBE},{".",0xBE},{"slash",0xBF},{"/",0xBF},
        {"backtick",0xC0},{"`",0xC0},{"lbracket",0xDB},{"[",0xDB},{"backslash",0xDC},{"\\",0xDC},
        {"rbracket",0xDD},{"]",0xDD},{"quote",0xDE},{"'",0xDE}
    };

    static ushort Resolve(string name)
    {
        name = name.Trim();
        if (name.Length == 0) throw new ArgumentException("bos tus");
        ushort vk;
        if (Vk.TryGetValue(name, out vk)) return vk;
        if (name.Length == 1)
        {
            char c = char.ToUpperInvariant(name[0]);
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) return (ushort)c;
        }
        throw new ArgumentException("bilinmeyen tus: " + name);
    }

    static INPUT MakeKey(ushort vk, bool up)
    {
        uint flags = up ? KEYEVENTF_KEYUP : 0;
        if (Extended.Contains(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
        INPUT i = new INPUT();
        i.type = INPUT_KEYBOARD;
        i.U.ki.wVk = vk;
        i.U.ki.wScan = 0;
        i.U.ki.dwFlags = flags;
        i.U.ki.time = 0;
        i.U.ki.dwExtraInfo = IntPtr.Zero;
        return i;
    }

    static INPUT MakeUnicode(char ch, bool up)
    {
        uint flags = KEYEVENTF_UNICODE | (up ? KEYEVENTF_KEYUP : 0);
        INPUT i = new INPUT();
        i.type = INPUT_KEYBOARD;
        i.U.ki.wVk = 0;
        i.U.ki.wScan = ch;
        i.U.ki.dwFlags = flags;
        i.U.ki.time = 0;
        i.U.ki.dwExtraInfo = IntPtr.Zero;
        return i;
    }

    static void Send(INPUT[] inputs)
    {
        if (inputs.Length == 0) return;
        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
        if (sent != inputs.Length)
            throw new Exception("SendInput basarisiz, win32 hata " + Marshal.GetLastWin32Error());
    }

    // "ctrl+shift+esc" -> modifier'lari sirayla bas, son tusa vur, ters sirada birak.
    static void SendCombo(string combo)
    {
        string[] parts = combo.Split('+');
        List<ushort> keys = new List<ushort>();
        foreach (string p in parts)
        {
            string t = p.Trim();
            if (t.Length > 0) keys.Add(Resolve(t));
        }
        if (keys.Count == 0) throw new ArgumentException("bos kombinasyon");

        List<INPUT> seq = new List<INPUT>();
        for (int i = 0; i < keys.Count; i++) seq.Add(MakeKey(keys[i], false));
        for (int i = keys.Count - 1; i >= 0; i--) seq.Add(MakeKey(keys[i], true));
        Send(seq.ToArray());
    }

    static void SendText(string text)
    {
        List<INPUT> seq = new List<INPUT>();
        foreach (char ch in text)
        {
            if (ch == '\n')
            {
                seq.Add(MakeKey(0x0D, false));
                seq.Add(MakeKey(0x0D, true));
            }
            else if (ch != '\r')
            {
                seq.Add(MakeUnicode(ch, false));
                seq.Add(MakeUnicode(ch, true));
            }
            // SendInput tek cagrida sinirli sayida olay alir; parca parca gonder.
            if (seq.Count >= 200) { Send(seq.ToArray()); seq.Clear(); }
        }
        Send(seq.ToArray());
    }

    // ---------------------------------------------------------------- fare

    static INPUT MakeMouse(int dx, int dy, uint flags, int data)
    {
        INPUT i = new INPUT();
        i.type = INPUT_MOUSE;
        i.U.mi.dx = dx;
        i.U.mi.dy = dy;
        i.U.mi.mouseData = unchecked((uint)data);
        i.U.mi.dwFlags = flags;
        i.U.mi.time = 0;
        i.U.mi.dwExtraInfo = IntPtr.Zero;
        return i;
    }

    static void MouseMove(int dx, int dy)
    {
        if (dx == 0 && dy == 0) return;
        Send(new INPUT[] { MakeMouse(dx, dy, MOUSEEVENTF_MOVE, 0) });
    }

    static void ButtonFlags(string btn, out uint down, out uint up)
    {
        switch ((btn ?? "left").Trim().ToLowerInvariant())
        {
            case "left":   down = MOUSEEVENTF_LEFTDOWN;   up = MOUSEEVENTF_LEFTUP;   break;
            case "right":  down = MOUSEEVENTF_RIGHTDOWN;  up = MOUSEEVENTF_RIGHTUP;  break;
            case "middle": down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; break;
            default: throw new ArgumentException("bilinmeyen dugme: " + btn);
        }
    }

    static void MouseClick(string btn)
    {
        uint d, u;
        ButtonFlags(btn, out d, out u);
        Send(new INPUT[] { MakeMouse(0, 0, d, 0), MakeMouse(0, 0, u, 0) });
    }

    static void MouseButton(string btn, bool press)
    {
        uint d, u;
        ButtonFlags(btn, out d, out u);
        Send(new INPUT[] { MakeMouse(0, 0, press ? d : u, 0) });
    }

    // amount: 1 = bir tekerlek centigi. Kesirli degerler icin cagiran tarafta biriktir.
    static void MouseScroll(double amount, bool horizontal)
    {
        int data = (int)Math.Round(amount * WHEEL_DELTA);
        if (data == 0) return;
        Send(new INPUT[] { MakeMouse(0, 0, horizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL, data) });
    }

    // Ctrl+tekerlek (yakinlastirma) TEK cagrida yapilir. Bunu Node tarafindan
    // "bas / kaydir / birak" diye uc ayri tura bolersek, arada bir mesaj
    // duserse Ctrl basili kalir ve bilgisayar kullanilamaz hale gelir.
    static void MouseZoom(double amount)
    {
        const ushort VK_CONTROL = 0xA2;
        Send(new INPUT[] { MakeKey(VK_CONTROL, false) });
        try { MouseScroll(amount, false); }
        finally { Send(new INPUT[] { MakeKey(VK_CONTROL, true) }); }
    }

    static int ArgInt(string[] parts, int idx)
    {
        int v;
        if (parts.Length <= idx || !int.TryParse(parts[idx], System.Globalization.NumberStyles.Integer,
            System.Globalization.CultureInfo.InvariantCulture, out v))
            throw new ArgumentException("sayi bekleniyordu");
        return v;
    }

    static double ArgDouble(string[] parts, int idx)
    {
        double v;
        if (parts.Length <= idx || !double.TryParse(parts[idx], System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out v))
            throw new ArgumentException("sayi bekleniyordu");
        return v;
    }

    static int Main()
    {
        var stdout = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
        stdout.AutoFlush = true;
        var stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));

        string line;
        while ((line = stdin.ReadLine()) != null)
        {
            if (line.Length == 0) continue;
            try
            {
                int sp = line.IndexOf(' ');
                string cmd = sp < 0 ? line : line.Substring(0, sp);
                string arg = sp < 0 ? "" : line.Substring(sp + 1);

                string[] a = arg.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

                switch (cmd.ToUpperInvariant())
                {
                    case "KEY": SendCombo(arg); stdout.WriteLine("OK"); break;
                    case "TEXT": SendText(arg); stdout.WriteLine("OK"); break;
                    case "KDOWN": Send(new INPUT[] { MakeKey(Resolve(arg), false) }); stdout.WriteLine("OK"); break;
                    case "KUP": Send(new INPUT[] { MakeKey(Resolve(arg), true) }); stdout.WriteLine("OK"); break;
                    case "MMOVE": MouseMove(ArgInt(a, 0), ArgInt(a, 1)); stdout.WriteLine("OK"); break;
                    case "MCLICK": MouseClick(a.Length > 0 ? a[0] : "left"); stdout.WriteLine("OK"); break;
                    case "MDOWN": MouseButton(a.Length > 0 ? a[0] : "left", true); stdout.WriteLine("OK"); break;
                    case "MUP": MouseButton(a.Length > 0 ? a[0] : "left", false); stdout.WriteLine("OK"); break;
                    case "MSCROLL": MouseScroll(ArgDouble(a, 0), false); stdout.WriteLine("OK"); break;
                    case "MHSCROLL": MouseScroll(ArgDouble(a, 0), true); stdout.WriteLine("OK"); break;
                    case "MZOOM": MouseZoom(ArgDouble(a, 0)); stdout.WriteLine("OK"); break;
                    case "PING": stdout.WriteLine("PONG"); break;
                    default: stdout.WriteLine("ERR bilinmeyen komut: " + cmd); break;
                }
            }
            catch (Exception ex)
            {
                stdout.WriteLine("ERR " + ex.Message.Replace('\n', ' ').Replace('\r', ' '));
            }
        }
        return 0;
    }
}
