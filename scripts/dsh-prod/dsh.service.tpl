# DeepSeek Harness Web — MedAi 生产服务（installer 自动生成）
[Unit]
Description=DeepSeek Harness Web (MedAi production)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=__USER__
Group=__USER__
WorkingDirectory=__INSTALL_DIR__/deepseek-harness
# DSH 数据目录（会话/凭据/profile/附件，备份对象）
Environment=DSH_HOME=__DSH_HOME__
# 每机 token（DSH_MACHINE_TOKEN=LLM M3 代理；MEDAI_MCP_TOKEN=MCP M2 网关）
EnvironmentFile=/etc/dsh-prod/env
# 直接调用 bin.ts（绕过 pnpm deps-check：解包/离线目录下 pnpm 会尝试重装导致起不来）
ExecStart=__INSTALL_DIR__/node/bin/node --import tsx/esm apps/cli/src/bin.ts web --host 127.0.0.1
Restart=always
RestartSec=5
LimitNOFILE=65535
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
