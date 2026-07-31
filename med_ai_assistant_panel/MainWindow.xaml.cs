using System.Windows;
using System.Windows.Media.Animation;
using MedAiPanel.Models;
using MedAiPanel.Services;
using MouseEventArgs = System.Windows.Input.MouseEventArgs;

namespace MedAiPanel;

/// <summary>
/// 悬浮球主窗口：贴屏幕右缘的窄竖条，悬停展开病人列表。
/// 核心职责：桌面会话轮询（显隐驱动）、病人列表获取展示、点击发送选中指令并激活浏览器窗口。
/// </summary>
public partial class MainWindow : Window
{
    private const double CollapsedWidth = 14;
    private const double ExpandedWidth = 260;
    private static readonly TimeSpan ExpandDuration = TimeSpan.FromMilliseconds(180);
    private static readonly TimeSpan PatientListRefreshInterval = TimeSpan.FromSeconds(10);

    /// <summary>连续无活跃会话轮询次数上限（5s×72≈6分钟）后自动退出进程</summary>
    private const int MaxInactivePollsBeforeExit = 72;

    private readonly AppConfig _config;
    private readonly ApiClient _apiClient;
    private readonly Action _requestShutdown;
    private readonly CancellationTokenSource _cts = new();

    /// <summary>当前活跃会话（token 仅内存缓存，不落盘）</summary>
    private DesktopSessionInfo? _session;
    private DateTime _lastPatientLoad = DateTime.MinValue;
    private bool _expanded;
    private bool _animating;

    /// <summary>用户是否手动隐藏了侧边栏（true 时轮询循环不自动显示）</summary>
    private bool _userHidden;

    public MainWindow(AppConfig config, Action requestShutdown)
    {
        InitializeComponent();
        _config = config;
        _apiClient = new ApiClient(config);
        _requestShutdown = requestShutdown;

        // 必须在构造函数中启动轮询：Loaded 事件仅在 Show() 时触发，
        // 而 Show() 由 PollLoopAsync 调用，形成死锁。
        PositionWindow();
        _ = PollLoopAsync(_cts.Token);
    }

    /// <summary>停止轮询循环（应用退出前调用）</summary>
    public void StopPolling() => _cts.Cancel();

    /// <summary>
    /// 托盘菜单手动切换侧边栏显隐（覆盖轮询自动逻辑）。
    /// 用户隐藏后轮询不再自动显示，直到用户再次点击显示。
    /// </summary>
    public void ToggleUserVisibility()
    {
        _userHidden = !_userHidden;
        Dispatcher.Invoke(() =>
        {
            if (_userHidden)
            {
                if (IsVisible) Hide();
            }
            else
            {
                // 恢复显示：仅当存在活跃会话时才显示
                if (_session?.Active == true && !IsVisible)
                {
                    Show();
                }
            }
        });
    }

    /// <summary>当前侧边栏是否由用户手动隐藏</summary>
    public bool IsUserHidden => _userHidden;

    /// <summary>
    /// 窗口初始定位：贴屏幕右缘，垂直居中
    /// </summary>
    private void PositionWindow()
    {
        var workArea = SystemParameters.WorkArea;
        Height = Math.Min(420, workArea.Height * 0.6);
        Width = CollapsedWidth;
        Left = workArea.Right - Width;
        Top = workArea.Top + (workArea.Height - Height) / 2;
    }

    /// <summary>
    /// 会话轮询循环：active=true 显示悬浮球并缓存最新 token（前端重新登录后自动更新），
    /// active=false 隐藏悬浮球（token 过期/登出由后端闭环校验，无需依赖前端注销动作）。
    /// </summary>
    private async Task PollLoopAsync(CancellationToken ct)
    {
        int consecutiveInactive = 0;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var session = await _apiClient.GetActiveSessionAsync(ct);
                if (session?.Active == true && !string.IsNullOrEmpty(session.Token))
                {
                    consecutiveInactive = 0;
                    var previousToken = _session?.Token;
                    _session = session;
                    if (previousToken != session.Token)
                    {
                        // 会话变更（重新登录）：强制下次展开时刷新病人列表
                        _lastPatientLoad = DateTime.MinValue;
                    }
                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (!IsVisible && !_userHidden)
                        {
                            Show();
                        }
                        UserInfoText.Text = session.UserName ?? "";
                    });
                }
                else
                {
                    consecutiveInactive++;
                    _session = null;
                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (IsVisible)
                        {
                            Hide();
                        }
                    });
                    if (consecutiveInactive >= MaxInactivePollsBeforeExit)
                    {
                        await Dispatcher.InvokeAsync(_requestShutdown);
                        return;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                // 网络异常：保持当前显隐状态，下轮重试
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, _config.PollIntervalSeconds)), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private void Window_MouseEnter(object sender, MouseEventArgs e)
    {
        if (_expanded || _animating)
        {
            return;
        }
        Expand();
    }

    private void Window_MouseLeave(object sender, MouseEventArgs e)
    {
        if (!_expanded || _animating)
        {
            return;
        }
        Collapse();
    }

    /// <summary>
    /// 展开面板（悬停）：动画加宽窗口（保持右缘贴边不动），并刷新病人列表
    /// </summary>
    private void Expand()
    {
        _expanded = true;
        _animating = true;
        ExpandedPanel.Visibility = Visibility.Visible;
        CollapsedBar.Visibility = Visibility.Collapsed;
        AnimateWindow(ExpandedWidth, () =>
        {
            _animating = false;
            // 动画期间鼠标已离开：立即收起，避免面板滞留
            if (!IsMouseOver)
            {
                Collapse();
            }
        });
        _ = RefreshPatientsIfNeededAsync();
    }

    /// <summary>
    /// 收起面板（鼠标离开）：动画收窄回竖条
    /// </summary>
    private void Collapse()
    {
        _expanded = false;
        _animating = true;
        AnimateWindow(CollapsedWidth, () =>
        {
            ExpandedPanel.Visibility = Visibility.Collapsed;
            CollapsedBar.Visibility = Visibility.Visible;
            _animating = false;
            // 动画期间鼠标重新进入：立即展开
            if (IsMouseOver)
            {
                Expand();
            }
        });
        PatientListBox.SelectedItem = null;
    }

    /// <summary>
    /// 窗口宽度+位置联动动画：左缘左移，右缘保持贴屏幕边缘不动
    /// </summary>
    private void AnimateWindow(double targetWidth, Action onCompleted)
    {
        double right = Left + Width;
        var duration = new Duration(ExpandDuration);
        var easing = new QuadraticEase { EasingMode = EasingMode.EaseOut };

        var widthAnimation = new DoubleAnimation(targetWidth, duration) { EasingFunction = easing };
        widthAnimation.Completed += (_, _) => onCompleted();
        var leftAnimation = new DoubleAnimation(right - targetWidth, duration) { EasingFunction = easing };

        BeginAnimation(WidthProperty, widthAnimation);
        BeginAnimation(LeftProperty, leftAnimation);
    }

    /// <summary>
    /// 展开时刷新病人列表（10 秒内不重复刷新；用缓存 token 调现有科室病人列表 API）
    /// </summary>
    private async Task RefreshPatientsIfNeededAsync()
    {
        if (_session?.Token == null || string.IsNullOrEmpty(_session.DepartmentName))
        {
            return;
        }
        if (DateTime.Now - _lastPatientLoad < PatientListRefreshInterval)
        {
            return;
        }

        try
        {
            StatusText.Text = "加载中...";
            var patients = await _apiClient.GetPatientsAsync(_session.Token, _session.DepartmentName, _cts.Token);
            _lastPatientLoad = DateTime.Now;
            await Dispatcher.InvokeAsync(() =>
            {
                PatientListBox.ItemsSource = patients;
                StatusText.Text = $"共 {patients.Count} 人";
            });
        }
        catch (OperationCanceledException)
        {
        }
        catch
        {
            await Dispatcher.InvokeAsync(() => StatusText.Text = "病人列表加载失败");
        }
    }

    /// <summary>
    /// 点击病人：发送选中指令（SSE 推送到主界面完成选中切换）→ Win32 激活浏览器窗口
    /// </summary>
    private async void PatientListBox_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (PatientListBox.SelectedItem is not Patient patient)
        {
            return;
        }
        if (_session?.Token == null)
        {
            return;
        }

        try
        {
            await _apiClient.SendSelectCommandAsync(_session.Token, patient.PatientId, _cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }
        catch
        {
            StatusText.Text = "指令发送失败";
            return;
        }

        var result = BrowserActivator.ActivateByTitleKeyword(_config.WindowTitleKeyword);
        if (result == BrowserActivator.ActivateResult.NotFound)
        {
            // 浏览器未运行：用默认浏览器打开前端页面地址（开发模式 8080，生产模式由 nginx 代理到同一地址）
            BrowserActivator.OpenSystemInBrowser(_config.FrontendUrl);
        }
        // 置前失败时 BrowserActivator 已自动触发任务栏闪动提示

        // 复位选中态，允许再次点击同一行
        PatientListBox.SelectedItem = null;
    }
}
