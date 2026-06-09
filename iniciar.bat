@echo off
echo.
echo  ================================================
echo   Freimanautos - Sistema Operativo
echo  ================================================
echo.

:: Verificar que existe config.js
if not exist "js\config.js" (
  echo  [ERROR] No se encontro js\config.js
  echo  Copia js\config.example.js como js\config.js
  echo  y rellena las credenciales de Supabase y n8n.
  echo.
  pause
  exit /b 1
)

:: Intentar abrir con VS Code Live Server si esta instalado
where code >nul 2>&1
if %errorlevel% == 0 (
  echo  Abriendo en VS Code...
  code .
  echo.
  echo  Activa Live Server (boton en la barra inferior de VS Code)
  echo  o presiona Alt+L, Alt+O
) else (
  echo  Abriendo index.html en el navegador...
  start index.html
)

echo.
echo  URL local: http://127.0.0.1:5500
echo.
pause
