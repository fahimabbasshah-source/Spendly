@echo off
cd /d "%~dp0"
echo ============================================
echo   Spendly - starting local server
echo ============================================
echo On this PC:        http://localhost:4173
echo On your iPhone (same WiFi): http://%COMPUTERNAME%:4173  (or use your PC's IP shown below)
ipconfig | findstr /i "IPv4"
echo.
echo Open the iPhone link above in Safari, then
echo Share button -^> Add to Home Screen.
echo Press Ctrl+C here to stop the server.
echo ============================================
python -m http.server 4173
pause
