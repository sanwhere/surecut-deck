// Sistem olcumlerini toplar ve her araligi bir satir JSON olarak stdout'a yazar.
//
//   StatsHelper.exe [aralik_ms]
//
// Neden InputHelper'dan ayri bir surec: GPU sayacini okumak yuzlerce milisaniye
// surebiliyor. Ayni surecte olsaydi bu gecikme dogrudan tus basislarina yansirdi.
//
// Bir olcum alinamazsa o alan null doner; surec asla dusmez. Cagiran tarafin
// "yok" ile "sifir" arasindaki farki gorebilmesi icin bu ayrim onemli.
//
// Sayilar her zaman InvariantCulture ile yazilir: Turkce Windows'ta ondalik
// ayirici virgul oldugu icin aksi halde uretilen JSON bozuk olurdu.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class StatsHelper
{
  // ------------------------------------------------------------------ win32

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool GetSystemTimes(out long idleTime, out long kernelTime, out long userTime);

  [StructLayout(LayoutKind.Sequential)]
  class MEMORYSTATUSEX
  {
    public uint dwLength;
    public uint dwMemoryLoad;
    public ulong ullTotalPhys;
    public ulong ullAvailPhys;
    public ulong ullTotalPageFile;
    public ulong ullAvailPageFile;
    public ulong ullTotalVirtual;
    public ulong ullAvailVirtual;
    public ulong ullAvailExtendedVirtual;
    public MEMORYSTATUSEX() { dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX)); }
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

  [DllImport("kernel32.dll")]
  static extern ulong GetTickCount64();

  // ------------------------------------------------------------------ durum

  static long prevIdle, prevKernel, prevUser;
  static bool haveCpuBaseline;

  static long prevRx, prevTx;
  static DateTime prevNetAt;
  static bool haveNetBaseline;

  static PerformanceCounter diskCounter;
  static bool diskOk = true;

  static PerformanceCounter[] gpuCounters;
  static DateTime gpuListAt = DateTime.MinValue;
  static bool gpuOk = true;
  static int gpuSlow;
  // GPU Engine'in yuzlerce ornegi olabiliyor ve hepsini okumak bu makinede
  // ~280 ms suruyor. Saniyede bir odemek yerine kendi seyrek temposunda
  // orneklenip aradaki turlarda son deger tekrar ediliyor.
  static DateTime gpuSampledAt = DateTime.MinValue;
  static double? gpuLast;

  static bool tempOk = true;
  static string tempWhy;   // null | "admin" | "none"

  // ------------------------------------------------------------------ olcum

  static string Num(double v)
  {
    if (double.IsNaN(v) || double.IsInfinity(v)) return "null";
    return v.ToString("0.##", CultureInfo.InvariantCulture);
  }

  static string Num(ulong v) { return v.ToString(CultureInfo.InvariantCulture); }

  static double? ReadCpu()
  {
    long idle, kernel, user;
    if (!GetSystemTimes(out idle, out kernel, out user)) return null;

    double pct = 0;
    if (haveCpuBaseline)
    {
      // kernel zaten idle'i icerir, dolayisiyla toplam = kernel + user.
      long dIdle = idle - prevIdle;
      long dTotal = (kernel - prevKernel) + (user - prevUser);
      if (dTotal > 0) pct = 100.0 * (dTotal - dIdle) / dTotal;
    }
    prevIdle = idle; prevKernel = kernel; prevUser = user;

    if (!haveCpuBaseline) { haveCpuBaseline = true; return null; }
    return pct < 0 ? 0 : (pct > 100 ? 100 : pct);
  }

  static string ReadRam()
  {
    MEMORYSTATUSEX m = new MEMORYSTATUSEX();
    if (!GlobalMemoryStatusEx(m)) return "null";
    ulong used = m.ullTotalPhys - m.ullAvailPhys;
    double pct = m.ullTotalPhys > 0 ? 100.0 * used / m.ullTotalPhys : 0;
    return "{\"used\":" + Num(used) + ",\"total\":" + Num(m.ullTotalPhys) + ",\"pct\":" + Num(pct) + "}";
  }

  static string ReadDisks()
  {
    StringBuilder sb = new StringBuilder("[");
    bool first = true;
    DriveInfo[] drives;
    try { drives = DriveInfo.GetDrives(); }
    catch { return "[]"; }

    foreach (DriveInfo d in drives)
    {
      try
      {
        if (d.DriveType != DriveType.Fixed || !d.IsReady) continue;
        ulong total = (ulong)d.TotalSize;
        if (total == 0) continue;
        ulong free = (ulong)d.TotalFreeSpace;
        ulong used = total - free;
        double pct = 100.0 * used / total;
        if (!first) sb.Append(',');
        first = false;
        // Surucu harfi "C:\" seklinde gelir; JSON'a ters bolu kacisi sokmamak icin kirpiyoruz.
        string id = d.Name.TrimEnd('\\', '/');
        sb.Append("{\"id\":\"").Append(id).Append("\",\"used\":").Append(Num(used))
          .Append(",\"total\":").Append(Num(total)).Append(",\"pct\":").Append(Num(pct)).Append('}');
      }
      catch { /* cikarilabilir surucu tam bu anda cikarilmis olabilir */ }
    }
    return sb.Append(']').ToString();
  }

  static double? ReadDiskBusy()
  {
    if (!diskOk) return null;
    try
    {
      if (diskCounter == null)
      {
        diskCounter = new PerformanceCounter("PhysicalDisk", "% Disk Time", "_Total", true);
        diskCounter.NextValue();
        return null; // ilk okuma her zaman 0 doner, atla
      }
      double v = diskCounter.NextValue();
      return v > 100 ? 100 : v;
    }
    catch { diskOk = false; diskCounter = null; return null; }
  }

  static string ReadNet()
  {
    try
    {
      long rx = 0, tx = 0;
      NetworkInterface[] ifs = NetworkInterface.GetAllNetworkInterfaces();
      foreach (NetworkInterface ni in ifs)
      {
        if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
        if (ni.OperationalStatus != OperationalStatus.Up) continue;
        IPv4InterfaceStatistics s = ni.GetIPv4Statistics();
        rx += s.BytesReceived;
        tx += s.BytesSent;
      }

      DateTime now = DateTime.UtcNow;
      string result = "null";
      if (haveNetBaseline)
      {
        double secs = (now - prevNetAt).TotalSeconds;
        if (secs > 0)
        {
          // Sayac tasmasi veya arayuz sifirlanmasi negatif fark uretebilir.
          double down = Math.Max(0, rx - prevRx) / secs;
          double up = Math.Max(0, tx - prevTx) / secs;
          result = "{\"down\":" + Num(down) + ",\"up\":" + Num(up) + "}";
        }
      }
      prevRx = rx; prevTx = tx; prevNetAt = now; haveNetBaseline = true;
      return result;
    }
    catch { return "null"; }
  }

  const int GPU_PERIOD_SEC = 3;

  static double? ReadGpu()
  {
    if (!gpuOk) return null;
    if ((DateTime.UtcNow - gpuSampledAt).TotalSeconds < GPU_PERIOD_SEC) return gpuLast;
    gpuSampledAt = DateTime.UtcNow;
    try
    {
      // Ornek listesi surecler geldikce degisiyor; her saniye yeniden kurmak
      // pahali oldugu icin 10 saniyede bir tazeliyoruz.
      //
      // Bu kurulum asamasi olcuye DAHIL EDILMEZ: ilk turda yuzlerce sayaci
      // acmak yarim saniye surebiliyor ve bunu yavaslik sanip GPU'yu kapatmak,
      // sonraki turlarda milisaniyeler suren okumayi bosuna feda etmek olurdu.
      if (gpuCounters == null || (DateTime.UtcNow - gpuListAt).TotalSeconds > 10)
      {
        PerformanceCounterCategory cat = new PerformanceCounterCategory("GPU Engine");
        string[] names = cat.GetInstanceNames();
        List<PerformanceCounter> list = new List<PerformanceCounter>();
        foreach (string n in names)
        {
          if (n.IndexOf("engtype_3D", StringComparison.OrdinalIgnoreCase) < 0) continue;
          try
          {
            PerformanceCounter pc = new PerformanceCounter("GPU Engine", "Utilization Percentage", n, true);
            pc.NextValue();
            list.Add(pc);
          }
          catch { }
        }
        gpuCounters = list.ToArray();
        gpuListAt = DateTime.UtcNow;
      }

      Stopwatch sw = Stopwatch.StartNew();
      double sum = 0;
      foreach (PerformanceCounter pc in gpuCounters)
      {
        try { sum += pc.NextValue(); } catch { }
      }

      // Seyrek ornekledigimiz icin birkac yuz milisaniye artik kabul edilebilir;
      // esik yalnizca gercekten patolojik durumlar icin duruyor.
      if (sw.ElapsedMilliseconds > 1200)
      {
        gpuSlow++;
        if (gpuSlow >= 3)
        {
          gpuOk = false;
          gpuCounters = null;
          gpuLast = null;
          Console.Error.WriteLine("[stats] GPU okumasi ust uste cok yavas (" + sw.ElapsedMilliseconds + " ms), kapatildi");
          return null;
        }
      }
      else gpuSlow = 0;

      gpuLast = sum > 100 ? 100 : sum;
      return gpuLast;
    }
    catch { gpuOk = false; gpuCounters = null; gpuLast = null; return null; }
  }

  static double? ReadTemp()
  {
    // MSAcpi_ThermalZoneTemperature yonetici hakki ister ve bazi anakartlar
    // bunu hic yayinlamaz. Bir kez denenir; olmuyorsa bir daha ugrasilmaz.
    //
    // Iki basarisizlik ayri seyler ve kullaniciya farkli sey soylemek gerekir:
    // yetki reddi host'u yonetici olarak calistirinca cozulur, donanimin hic
    // termal bolge yayinlamamasi ise cozulmez.
    if (!tempOk) return null;
    try
    {
      double best = 0;
      bool found = false;
      ManagementObjectSearcher searcher = new ManagementObjectSearcher(
        @"root\WMI", "SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature");
      foreach (ManagementObject mo in searcher.Get())
      {
        object raw = mo["CurrentTemperature"];
        if (raw == null) continue;
        // Ondabir Kelvin cinsinden gelir.
        double c = (Convert.ToDouble(raw, CultureInfo.InvariantCulture) / 10.0) - 273.15;
        if (c > -50 && c < 150 && c > best) { best = c; found = true; }
      }
      if (!found) { tempOk = false; tempWhy = "none"; return null; }
      tempWhy = null;
      return best;
    }
    catch (UnauthorizedAccessException)
    {
      tempOk = false;
      tempWhy = "admin";
      return null;
    }
    catch (ManagementException e)
    {
      tempOk = false;
      // Saglayici yetki reddini bazen ManagementException olarak veriyor.
      tempWhy = (e.ErrorCode == ManagementStatus.AccessDenied) ? "admin" : "none";
      return null;
    }
    catch
    {
      tempOk = false;
      tempWhy = "none";
      return null;
    }
  }

  // ------------------------------------------------------------------- ana

  static string Opt(double? v) { return v.HasValue ? Num(v.Value) : "null"; }

  static void Main(string[] args)
  {
    int interval = 1000;
    if (args.Length > 0)
    {
      int parsed;
      if (int.TryParse(args[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
        interval = Math.Max(250, Math.Min(60000, parsed));
    }

    // Ebeveyn olurse stdin kapanir; yetim kalmamak icin o an cikiyoruz.
    Thread watch = new Thread(delegate ()
    {
      try { while (Console.In.ReadLine() != null) { } }
      catch { }
      Environment.Exit(0);
    });
    watch.IsBackground = true;
    watch.Start();

    while (true)
    {
      StringBuilder sb = new StringBuilder(512);
      sb.Append("{\"cpu\":").Append(Opt(ReadCpu()));
      sb.Append(",\"ram\":").Append(ReadRam());
      sb.Append(",\"disks\":").Append(ReadDisks());
      sb.Append(",\"diskBusy\":").Append(Opt(ReadDiskBusy()));
      sb.Append(",\"net\":").Append(ReadNet());
      sb.Append(",\"gpu\":").Append(Opt(ReadGpu()));
      double? temp = ReadTemp();
      sb.Append(",\"temp\":").Append(Opt(temp));
      // Sicaklik neden yok: istemci "yonetici gerekiyor" ile "bu makinede yok"
      // arasindaki farki gosterebilsin diye.
      sb.Append(",\"tempWhy\":").Append(tempWhy == null ? "null" : "\"" + tempWhy + "\"");
      sb.Append(",\"uptime\":").Append(Num(GetTickCount64() / 1000));
      sb.Append('}');

      Console.WriteLine(sb.ToString());
      Console.Out.Flush();

      Thread.Sleep(interval);
    }
  }
}
