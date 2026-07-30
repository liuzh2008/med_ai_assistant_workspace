using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MedAiPanel.Models;

/// <summary>
/// 本地配置（config.json，exe 同目录）
/// 禁止硬编码服务器地址，遵循项目配置驱动规范。
/// </summary>
public class AppConfig
{
    /// <summary>主服务器地址（含协议与端口，如 https://192.168.x.x）</summary>
    [JsonPropertyName("serverBaseUrl")]
    public string ServerBaseUrl { get; set; } = "https://localhost";

    /// <summary>浏览器主系统窗口标题模糊匹配关键字（用于 Win32 激活窗口）</summary>
    [JsonPropertyName("windowTitleKeyword")]
    public string WindowTitleKeyword { get; set; } = "医疗AI";

    /// <summary>桌面会话轮询间隔（秒）</summary>
    [JsonPropertyName("pollIntervalSeconds")]
    public int PollIntervalSeconds { get; set; } = 5;

    /// <summary>
    /// 从 exe 同目录加载 config.json；文件缺失或解析失败时返回默认配置
    /// </summary>
    public static AppConfig Load()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "config.json");
            // 单文件发布时 exe 在子目录（如 win-x64），回退到父目录查找
            if (!File.Exists(path))
            {
                var parentDir = Path.GetDirectoryName(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                if (parentDir != null)
                {
                    var parentPath = Path.Combine(parentDir, "config.json");
                    if (File.Exists(parentPath))
                    {
                        path = parentPath;
                    }
                }
            }
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var config = JsonSerializer.Deserialize<AppConfig>(json);
                if (config != null)
                {
                    return config;
                }
            }
        }
        catch
        {
            // 配置解析失败时使用默认配置，不阻断启动
        }
        return new AppConfig();
    }
}

/// <summary>
/// 桌面会话信息（对应后端 GET /api/desktop-sessions/active 响应）
/// token 仅内存缓存，不落盘。
/// </summary>
public class DesktopSessionInfo
{
    [JsonPropertyName("active")]
    public bool Active { get; set; }

    [JsonPropertyName("token")]
    public string? Token { get; set; }

    [JsonPropertyName("userId")]
    public string? UserId { get; set; }

    [JsonPropertyName("userName")]
    public string? UserName { get; set; }

    [JsonPropertyName("departmentId")]
    public string? DepartmentId { get; set; }

    [JsonPropertyName("departmentName")]
    public string? DepartmentName { get; set; }
}

/// <summary>
/// 在院病人信息（对应后端 GET /api/patients/by-department 响应项）
/// </summary>
public class Patient
{
    [JsonPropertyName("patientId")]
    public string PatientId { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("bedNumber")]
    public string BedNumber { get; set; } = "";

    /// <summary>病人状态（病危/病重/其他），用于列表状态色</summary>
    [JsonPropertyName("status")]
    public string? Status { get; set; }
}
