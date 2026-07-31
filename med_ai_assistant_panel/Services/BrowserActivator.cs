using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace MedAiPanel.Services;

/// <summary>
/// 浏览器窗口激活器（Win32）
/// 枚举顶层窗口按标题模糊匹配主系统页面，绕过 SetForegroundWindow 前台权限限制完成置前。
/// 限制与降级见方案文档：AttachThreadInput + 模拟 Alt 键为成熟 workaround；
/// 激活失败降级 FlashWindowEx 任务栏闪动；找不到窗口时用默认浏览器打开系统地址。
/// </summary>
public static class BrowserActivator
{
    /// <summary>窗口激活结果</summary>
    public enum ActivateResult
    {
        /// <summary>已置前</summary>
        Activated,
        /// <summary>未找到匹配窗口（浏览器未打开）</summary>
        NotFound,
        /// <summary>找到但置前失败（已自动触发任务栏闪动提示）</summary>
        Failed
    }

    private const int SwRestore = 9;
    private const int SwShow = 5;
    private const byte VkMenu = 0x12; // Alt 键
    private const uint KeyeventfKeyup = 0x0002;
    private const uint FlashwTray = 0x00000002;
    private const uint FlashwTimer = 0x00000004;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

    [StructLayout(LayoutKind.Sequential)]
    private struct FLASHWINFO
    {
        public uint cbSize;
        public IntPtr hwnd;
        public uint dwFlags;
        public uint uCount;
        public uint dwTimeout;
    }

    /// <summary>
    /// 按窗口标题关键字激活主系统浏览器窗口
    /// </summary>
    /// <param name="keyword">标题模糊匹配关键字（配置驱动，如"医疗AI"）</param>
    /// <returns>激活结果；失败时已自动触发任务栏闪动</returns>
    public static ActivateResult ActivateByTitleKeyword(string keyword)
    {
        var target = FindWindowByTitleKeyword(keyword);
        if (target == IntPtr.Zero)
        {
            return ActivateResult.NotFound;
        }

        ForceForeground(target);

        if (GetForegroundWindow() == target)
        {
            return ActivateResult.Activated;
        }

        // 置前失败：任务栏闪动提示用户手动点击（页面已由 SSE 完成选中切换）
        FlashWindow(target);
        return ActivateResult.Failed;
    }

    /// <summary>
    /// 用默认浏览器打开系统地址（浏览器未运行时的降级）
    /// </summary>
    public static void OpenSystemInBrowser(string serverBaseUrl)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = serverBaseUrl,
                UseShellExecute = true
            });
        }
        catch
        {
            // 打开浏览器失败时静默（用户可手动打开）
        }
    }

    /// <summary>
    /// 枚举可见顶层窗口，返回标题包含关键字的第一个窗口句柄
    /// </summary>
    private static IntPtr FindWindowByTitleKeyword(string keyword)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, _) =>
        {
            if (!IsWindowVisible(hWnd))
            {
                return true;
            }
            var title = new StringBuilder(256);
            GetWindowText(hWnd, title, title.Capacity);
            if (title.ToString().Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                found = hWnd;
                return false; // 命中即停止枚举
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    /// <summary>
    /// 强制将窗口置前：最小化时恢复 → 附加前台线程输入队列 + 模拟 Alt 键 → SetForegroundWindow。
    /// 使用 SW_SHOW 而非 SW_RESTORE 保持最大化状态不变。
    /// </summary>
    private static void ForceForeground(IntPtr hWnd)
    {
        // 仅在窗口最小化时使用 SW_RESTORE 恢复；否则用 SW_SHOW 保持当前窗口状态（最大化/普通）
        ShowWindow(hWnd, IsIconic(hWnd) ? SwRestore : SwShow);
        BringWindowToTop(hWnd);

        var foregroundWindow = GetForegroundWindow();
        uint foregroundThread = GetWindowThreadProcessId(foregroundWindow, out _);
        uint currentThread = GetCurrentThreadId();

        if (foregroundThread != currentThread)
        {
            AttachThreadInput(currentThread, foregroundThread, true);
            // 模拟 Alt 键按下/释放，使当前进程获得前台权限（绕过 SetForegroundWindow 限制）
            keybd_event(VkMenu, 0, 0, UIntPtr.Zero);
            keybd_event(VkMenu, 0, KeyeventfKeyup, UIntPtr.Zero);
            SetForegroundWindow(hWnd);
            AttachThreadInput(currentThread, foregroundThread, false);
        }
        else
        {
            SetForegroundWindow(hWnd);
        }

        BringWindowToTop(hWnd);
    }

    /// <summary>
    /// 任务栏图标闪动提示（激活失败的降级策略）
    /// </summary>
    private static void FlashWindow(IntPtr hWnd)
    {
        var info = new FLASHWINFO
        {
            cbSize = (uint)Marshal.SizeOf<FLASHWINFO>(),
            hwnd = hWnd,
            dwFlags = FlashwTray | FlashwTimer,
            uCount = 5,
            dwTimeout = 0
        };
        FlashWindowEx(ref info);
    }
}
