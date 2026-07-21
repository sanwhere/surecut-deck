// Tani kaydi. TrayContext.AddLog sinif icindeydi ve duzenleyici penceresinden
// erisilemiyordu; surukle birakin neden calismadigini anlamak icin olaylarin
// gunluge dusmesi gerekiyor.
//
// NOT: .NET Framework'un eski csc.exe'si ile derlenir (C# 5).

using System;
using System.IO;
using System.Text;

static class Diag
{
    static readonly object gate = new object();

    public static void Log(string line)
    {
        try
        {
            string stamped = DateTime.Now.ToString("HH:mm:ss") + "  " + line;
            lock (gate)
            {
                Directory.CreateDirectory(Paths.Data(""));
                File.AppendAllText(Paths.Data("tray.log"), stamped + Environment.NewLine, new UTF8Encoding(false));
            }
        }
        catch { /* gunluk yazilamazsa program yine calissin */ }
    }
}
