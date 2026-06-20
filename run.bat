@echo off
if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    call npm install
)
echo Starting dev server...
call npm run dev
pause
