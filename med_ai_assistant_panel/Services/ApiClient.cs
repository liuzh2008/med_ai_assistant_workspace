using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using MedAiPanel.Models;

namespace MedAiPanel.Services;

/// <summary>
/// 主服务器 API 客户端
/// 负责：桌面会话轮询、病人列表获取、病人选中指令发送。
/// 内网自签名证书场景跳过 TLS 证书校验（医疗内网私有 CA，与浏览器手动信任证书等效）。
/// </summary>
public class ApiClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;

    public ApiClient(AppConfig config)
    {
        _baseUrl = config.ServerBaseUrl.TrimEnd('/');
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        _http = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    /// <summary>
    /// 轮询本机活跃桌面会话（白名单端点，按来源 IP 匹配）
    /// </summary>
    /// <returns>会话信息；网络异常或响应解析失败时返回 null</returns>
    public async Task<DesktopSessionInfo?> GetActiveSessionAsync(CancellationToken ct)
    {
        var url = $"{_baseUrl}/api/desktop-sessions/active";
        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<DesktopSessionInfo>(ct);
    }

    /// <summary>
    /// 按科室获取在院病人列表（带 JWT 认证）
    /// </summary>
    /// <param name="token">会话 token（内存缓存，不落盘）</param>
    /// <param name="departmentName">科室名称</param>
    /// <returns>病人列表（按床号数字升序）；异常时返回空列表</returns>
    public async Task<List<Patient>> GetPatientsAsync(string token, string departmentName, CancellationToken ct)
    {
        var url = $"{_baseUrl}/api/patients/by-department?department={Uri.EscapeDataString(departmentName)}&sync=false";
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var patients = await response.Content.ReadFromJsonAsync<List<Patient>>(ct);
        return (patients ?? new List<Patient>())
            .OrderBy(p => int.TryParse(p.BedNumber, out var bed) ? bed : int.MaxValue)
            .ThenBy(p => p.BedNumber, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// 发送病人选中指令（后端经 SSE 推送到该用户所有在线页面）
    /// </summary>
    /// <param name="token">会话 token</param>
    /// <param name="patientId">目标病人ID</param>
    /// <returns>是否发送成功</returns>
    public async Task<bool> SendSelectCommandAsync(string token, string patientId, CancellationToken ct)
    {
        var url = $"{_baseUrl}/api/patient-select-commands";
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { patientId });
        var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode;
    }
}
