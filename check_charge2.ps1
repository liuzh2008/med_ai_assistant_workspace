# 检查 Lenovo 充电控制和 SmartEngine
Write-Host "=== 检查 LENOVO_GAMEZONE_DATA WMI 类 ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class LENOVO_GAMEZONE_DATA -ErrorAction SilentlyContinue | Format-List *

Write-Host "`n=== 检查 SmartEngine 配置 ===" -ForegroundColor Cyan
Get-ItemProperty 'HKLM:\SOFTWARE\Lenovo\SmartEngine\Configs' -ErrorAction SilentlyContinue
Get-ChildItem 'HKLM:\SOFTWARE\Lenovo\SmartEngine' -Recurse -ErrorAction SilentlyContinue | ForEach-Object { 
    Write-Output "Key: $($_.PSPath)"
    Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
}

Write-Host "`n=== 检查 LENOVO_GAMEZONE_POWER_CHARGE_MODE_EVENT ===" -ForegroundColor Cyan
$modeEvent = Get-WmiObject -Namespace root/wmi -Class LENOVO_GAMEZONE_POWER_CHARGE_MODE_EVENT -ErrorAction SilentlyContinue
if ($modeEvent) {
    $modeEvent | Format-List *
}

Write-Host "`n=== 检查 WMI 类上的方法 ===" -ForegroundColor Cyan
$classes = Get-WmiObject -Namespace root/wmi -List -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'LENOVO_GAMEZONE' }
foreach ($c in $classes) {
    Write-Output "Class: $($c.Name)"
    $c.Properties | ForEach-Object { Write-Output "  Property: $($_.Name)" }
    $c.Methods | ForEach-Object { Write-Output "  Method: $($_.Name)" }
}

Write-Host "`n=== 检查是否有其他充电控制接口 ===" -ForegroundColor Cyan
# Lenovo commercial Vantage also uses WMI
$commercialWMI = Get-WmiObject -Namespace root/wmi -List -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'ESSensor' }
foreach ($c in $commercialWMI) {
    Write-Output "Class: $($c.Name)"
}

Write-Host "`n=== 检查 BatteryCycleCount ===" -ForegroundColor Cyan
Get-WmiObject -Namespace root/wmi -Class BatteryCycleCount -ErrorAction SilentlyContinue | Select-Object *

Write-Host "`n=== 尝试通过 SystemSettings 查找充电设置 ===" -ForegroundColor Cyan
Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\*' -ErrorAction SilentlyContinue -Recurse | Where-Object { $_.Name -match 'Battery|Charge' } | ForEach-Object { Write-Output $_.PSPath; Get-ItemProperty $_.PSPath }

Write-Host "`n=== 检查所有注册表中可能的充电限制设置 ===" -ForegroundColor Cyan
$regPaths = @(
    'HKLM:\HARDWARE\ACPI\FACP\*',
    'HKLM:\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\*'
)
foreach ($rp in $regPaths) {
    $items = Get-ChildItem $rp -ErrorAction SilentlyContinue -Recurse | Where-Object { $_.Property -match 'Charge|Battery|Conservation' -or $_.Name -match 'Charge|Battery|Conservation' }
    foreach ($item in $items) {
        Write-Output "Found: $($item.PSPath)"
    }
}
