using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows;
using MedAiPanel.Models;
using Microsoft.Win32;
using Application = System.Windows.Application;
using ContextMenuStrip = System.Windows.Forms.ContextMenuStrip;
using NotifyIcon = System.Windows.Forms.NotifyIcon;
using ToolStripMenuItem = System.Windows.Forms.ToolStripMenuItem;

namespace MedAiPanel;

/// <summary>
/// 应用入口：单实例控制、托盘图标、配置加载、主窗口创建。
/// 悬浮球窗口初始隐藏，由轮询到活跃桌面会话后自动显示。
/// </summary>
public partial class App : Application
{
    private const string MutexName = @"Global\MedAiPanel_SingleInstance";
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "MedAiPanel";

    private static Mutex? _mutex;
    private NotifyIcon? _trayIcon;
    private ToolStripMenuItem? _autoStartMenuItem;
    private ToolStripMenuItem? _toggleSidebarMenuItem;
    private MainWindow? _mainWindow;
    private AppConfig _config = new();

    protected override void OnStartup(StartupEventArgs e)
    {
        // 单实例控制：重复启动直接退出
        _mutex = new Mutex(true, MutexName, out bool createdNew);
        if (!createdNew)
        {
            Shutdown();
            return;
        }

        base.OnStartup(e);

        _config = AppConfig.Load();
        _mainWindow = new MainWindow(_config, RequestShutdown);
        _mainWindow.Hide();
        SetupTrayIcon();
    }

    /// <summary>
    /// 初始化托盘图标与右键菜单（显示/隐藏侧边栏 / 开机自启 / 退出）
    /// </summary>
    private void SetupTrayIcon()
    {
        _toggleSidebarMenuItem = new ToolStripMenuItem("隐藏侧边栏", null, (_, _) =>
        {
            _mainWindow?.ToggleUserVisibility();
        });

        _autoStartMenuItem = new ToolStripMenuItem("开机自启")
        {
            Checked = IsAutoStartEnabled(),
            CheckOnClick = true
        };
        _autoStartMenuItem.CheckedChanged += (_, _) => SetAutoStart(_autoStartMenuItem.Checked);

        var contextMenu = new ContextMenuStrip();
        contextMenu.Items.Add(_toggleSidebarMenuItem);
        contextMenu.Items.Add(new ToolStripSeparator());
        contextMenu.Items.Add(_autoStartMenuItem);
        contextMenu.Items.Add(new ToolStripMenuItem("退出", null, (_, _) => RequestShutdown()));

        // 菜单打开时动态更新"显示/隐藏侧边栏"文案
        contextMenu.Opening += (_, _) =>
        {
            if (_toggleSidebarMenuItem == null || _mainWindow == null) return;
            _toggleSidebarMenuItem.Text = _mainWindow.IsUserHidden ? "显示侧边栏" : "隐藏侧边栏";
        };

        _trayIcon = new NotifyIcon
        {
            Icon = CreateTrayIcon(),
            Text = "医疗AI助手 - 侧边栏面板",
            Visible = true,
            ContextMenuStrip = contextMenu
        };
    }

    /// <summary>
    /// 生成托盘图标（蓝底白圆点，与主系统主色一致）
    /// </summary>
    private static Icon CreateTrayIcon()
    {
        var bitmap = new Bitmap(16, 16);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.FromArgb(13, 110, 253));
            using var brush = new SolidBrush(Color.White);
            g.FillEllipse(brush, 4, 4, 8, 8);
        }
        return Icon.FromHandle(bitmap.GetHicon());
    }

    /// <summary>
    /// 查询是否已设置开机自启（注册表 Run 键）
    /// </summary>
    private static bool IsAutoStartEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, false);
        return key?.GetValue(RunValueName) is string;
    }

    /// <summary>
    /// 设置/取消开机自启（写当前用户 Run 键，无需管理员权限）
    /// </summary>
    private static void SetAutoStart(bool enable)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, true);
            if (key == null) return;
            if (enable)
            {
                var processPath = Environment.ProcessPath;
                if (!string.IsNullOrEmpty(processPath))
                {
                    key.SetValue(RunValueName, $"\"{processPath}\"");
                }
            }
            else
            {
                key.DeleteValue(RunValueName, false);
            }
        }
        catch
        {
            // 注册表写入失败（权限受限）时静默，不影响主功能
        }
    }

    /// <summary>
    /// 退出应用：停止轮询、释放托盘与互斥锁
    /// </summary>
    private void RequestShutdown()
    {
        _mainWindow?.StopPolling();
        if (_trayIcon != null)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            _trayIcon = null;
        }
        Shutdown();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.ReleaseMutex();
        _mutex?.Dispose();
        base.OnExit(e);
    }
}
