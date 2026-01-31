@echo off
setlocal EnableDelayedExpansion

set MAX_LINES=1000

echo checking .ts files over %MAX_LINES% lines...
echo.

for /r %%F in (*.ts) do (
    for /f %%L in ('find /c /v "" "%%F"') do (
        if %%L GTR %MAX_LINES% (
            echo %%F  -  %%L lines
        )
    )
)

echo.
echo done.
pause
