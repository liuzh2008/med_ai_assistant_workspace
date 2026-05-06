# 进一步检查 Lenovo 充电控制
Write-Host "=== 检查 Lenovo 充电模式 WMI 类 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class LENOVO_GAMEZONE_POWER_CHARGE_MODE_EVENT -ErrorAction SilentlyContinue

Write-Host "`n=== 检查 Lenovo WMI 命名空间 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -List | Where-Object { $_.Name -match 'Lenovo|Charge|Power|Battery' } | Select-Object Name

Write-Host "`n=== 检查 Lenovo 相关的 WMI 命名空间 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root -List -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Lenovo' } | Select-Object Name

Write-Host "`n=== 检查 Energy/电源管理 WMI ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class BatteryCycleCount -ErrorAction SilentlyContinue | Select-Object *

Write-Host "`n=== 尝试读取 Lenovo 充电模式 (通过 ACPI 的 WMI 控制) ===" -ForegroundColor Cyan
# Modern Lenovo uses a dedicated WMI interface
$chargeModes = Get-WmiObject -Namespace root/wmi -List -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Lenovo|Charge|Charg' }
foreach ($cm in $chargeModes) {
    Write-Output "Found class: $($cm.Name)"
    try {
        $inst = Get-WmiObject -Namespace root/wmi -Class $cm.Name -ErrorAction SilentlyContinue
        $inst | Format-List *
    } catch { Write-Output "  Error: $_" }
}

Write-Host "`n=== 检查 Lenovo ACPI WMI 接口 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class LenovoBatteryChargeConfig -ErrorAction SilentlyContinue | Format-List *
Get-WmiObject -Namespace root/wmi -Class LENOVO_BATTERY_CHARGE_CONFIG -ErrorAction SilentlyContinue | Format-List *

Write-Host "`n=== 检查电池充电信息 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object *
Get-WmiObject -Namespace root/wmi -Class BatteryStaticData -ErrorAction SilentlyContinue | Select-Object *

Write-Host "`n=== Windows 电源计划 ===" -ForegroundColor Cyan
powercfg /LIST

Write-Host "`n=== 检查系统充电状态 ===" -ForegroundColor Cyan
# On newer Lenovo systems, conservation mode might be controlled through battery charge limits
Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object *
