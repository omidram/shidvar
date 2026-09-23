using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Security.Principal;
using System.Text;

internal static class Program
{
    const string Marker = "SHIDVAR_ZIP_PAYLOAD_V1:";

    static int Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.Title = "Shidvar";
        try
        {
            var exePath = Process.GetCurrentProcess().MainModule.FileName;
            if (IsElevated())
            {
                Console.WriteLine("Do not use Run as administrator.");
                Console.WriteLine("PostgreSQL cannot start in an elevated process.");
                Console.WriteLine("Restarting without administrator rights...");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = "\"" + exePath + "\"",
                    UseShellExecute = true,
                });
                return 0;
            }

            var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ShidvarDesktop");
            var payloadDir = Path.Combine(root, "payload");
            Directory.CreateDirectory(root);

            string version;
            long zipStart;
            if (!TryFindPayload(exePath, out zipStart, out version))
            {
                Console.WriteLine("This EXE is incomplete. Rebuild it with npm run package:win.");
                Console.ReadLine();
                return 1;
            }

            var stamp = Path.Combine(payloadDir, "PAYLOAD_VERSION");
            var launch = Path.Combine(payloadDir, "launch.mjs");
            var node = Path.Combine(payloadDir, "node.exe");
            if (!File.Exists(launch) || !File.Exists(node) || !File.Exists(stamp) || File.ReadAllText(stamp).Trim() != version)
            {
                Console.WriteLine("Extracting Shidvar...");
                if (Directory.Exists(payloadDir))
                {
                    try { Directory.Delete(payloadDir, true); }
                    catch (Exception ex)
                    {
                        Console.WriteLine("Cannot replace the previous extract (often left over from Run as administrator).");
                        Console.WriteLine("Delete this folder, then double-click Shidvar.exe normally:");
                        Console.WriteLine(payloadDir);
                        Console.WriteLine(ex.Message);
                        Console.ReadLine();
                        return 1;
                    }
                }
                Directory.CreateDirectory(payloadDir);
                var tmpZip = Path.Combine(Path.GetTempPath(), "shidvar-payload-" + Guid.NewGuid().ToString("N") + ".zip");
                using (var src = File.OpenRead(exePath))
                using (var dst = File.Create(tmpZip))
                {
                    src.Position = zipStart;
                    src.CopyTo(dst);
                }
                ZipFile.ExtractToDirectory(tmpZip, payloadDir);
                try { File.Delete(tmpZip); } catch { }
            }

            if (!File.Exists(node) || !File.Exists(launch))
            {
                Console.WriteLine("Extracted files are missing. Delete %LOCALAPPDATA%\\ShidvarDesktop and try again.");
                Console.ReadLine();
                return 1;
            }

            var psi = new ProcessStartInfo
            {
                FileName = node,
                Arguments = "launch.mjs",
                WorkingDirectory = payloadDir,
                UseShellExecute = false,
            };
            using (var proc = Process.Start(psi))
            {
                if (proc == null) return 1;
                proc.WaitForExit();
                return proc.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            Console.WriteLine("Press Enter to close.");
            try { Console.ReadLine(); } catch { }
            return 1;
        }
    }

    static bool IsElevated()
    {
        try
        {
            using (var id = WindowsIdentity.GetCurrent())
            {
                return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
            }
        }
        catch
        {
            return false;
        }
    }

    static bool TryFindPayload(string exePath, out long zipStart, out string version)
    {
        zipStart = 0;
        version = "";
        var needle = Encoding.UTF8.GetBytes(Marker);
        using (var fs = File.OpenRead(exePath))
        {
            var window = (int)Math.Min(fs.Length, 2 * 1024 * 1024);
            var buf = new byte[window];
            fs.Read(buf, 0, window);
            var idx = IndexOf(buf, needle);
            if (idx < 0) return false;
            var lineStart = idx + needle.Length;
            var lineEnd = lineStart;
            while (lineEnd < buf.Length && buf[lineEnd] != (byte)'\n') lineEnd++;
            version = Encoding.UTF8.GetString(buf, lineStart, lineEnd - lineStart).Trim();
            zipStart = lineEnd + 1;
            return version.Length > 0;
        }
    }

    static int IndexOf(byte[] haystack, byte[] needle)
    {
        for (var i = 0; i <= haystack.Length - needle.Length; i++)
        {
            var ok = true;
            for (var j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j]) { ok = false; break; }
            }
            if (ok) return i;
        }
        return -1;
    }
}
