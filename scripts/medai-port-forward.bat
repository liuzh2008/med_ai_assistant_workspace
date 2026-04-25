@echo off
REM MedAI Frontend Port Forwarding - Fix at startup
REM Forward port 8080 on 100.66.1.3 to 192.168.110.130:8080
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=192.168.110.130
