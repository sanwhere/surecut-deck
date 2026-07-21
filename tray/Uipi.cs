// Yonetici olarak calisirken surukle birakin calismasini saglar.
//
// Windows'ta UIPI (User Interface Privilege Isolation) yukseltilmis bir
// surecin, yukseltilmemis bir surecten gelen pencere mesajlarini sessizce
// dusurur. Explorer normal haklarla calistigi icin, tray yonetici olarak
// baslatildiginda masaustunden surukle birak hicbir iz birakmadan olmuyor:
// DragEnter bile tetiklenmiyor.
//
// Cozum, OLE surukle birakin kullandigi uc mesaji acikca gecirmek.
// ChangeWindowMessageFilterEx yalnizca verilen pencere icin gecerli, yani
// surecin tamamini savunmasiz birakmiyor.
//
// NOT: .NET Framework'un eski csc.exe'si ile derlenir (C# 5).

using System;
using System.Runtime.InteropServices;
using System.Security.Principal;

static class Uipi
{
    const uint WM_DROPFILES = 0x0233;
    const uint WM_COPYDATA = 0x004A;
    // Belgelenmemis ama OLE surukle birakin veriyi tasirken kullandigi mesaj.
    // Bu gecmezse dosya adlari elevated pencereye ulasmaz.
    const uint WM_COPYGLOBALDATA = 0x0049;

    const uint MSGFLT_ALLOW = 1;

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool ChangeWindowMessageFilterEx(IntPtr hwnd, uint msg, uint action, IntPtr changeInfo);

    static bool? elevated;

    public static bool IsElevated
    {
        get
        {
            if (elevated.HasValue) return elevated.Value;
            try
            {
                WindowsIdentity id = WindowsIdentity.GetCurrent();
                WindowsPrincipal p = new WindowsPrincipal(id);
                elevated = p.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch { elevated = false; }
            return elevated.Value;
        }
    }

    // Yukseltilmemisken hicbir sey yapmaz: filtre zaten engel degil.
    public static void AllowDrops(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return;
        if (!IsElevated) return;

        uint[] msgs = new uint[] { WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA };
        int ok = 0;
        foreach (uint m in msgs)
        {
            try { if (ChangeWindowMessageFilterEx(hwnd, m, MSGFLT_ALLOW, IntPtr.Zero)) ok++; }
            catch { /* cok eski Windows: filtre yok, zaten sorun da yok */ }
        }
        Diag.Log("[drop] yonetici olarak calisiyor, UIPI filtresi acildi (" + ok + "/3 mesaj)");
    }
}
