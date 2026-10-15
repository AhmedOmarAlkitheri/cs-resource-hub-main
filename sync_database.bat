@echo off
chcp 65001 > nul
title مزامنة قاعدة البيانات - جامعة أهل الحديث

echo ============================================================
echo      مزامنة قاعدة بيانات جامعة أهل الحديث (Neon Cloud)
echo ============================================================
echo.

echo [1/3] تحديث الجداول في قاعدة بيانات Neon سحابياً...
call npx prisma db push
if %errorlevel% neq 0 (
    echo.
    echo [خطأ] تعذر الاتصال أو مزامنة الجداول مع Neon.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] توليد محرك Prisma Client...
call npx prisma generate
echo.

echo [3/3] هل تريد إعادة زرع البيانات الأساسية للكليات والتخصصات (Seed)؟
echo اضغط Y للموافقة، أو N للتخطي.
set /p userChoice="اختيارك (Y/N): "

if /i "%userChoice%"=="Y" (
    echo جاري زراعة بيانات الكليات والمقررات في Neon...
    call npx prisma db seed
    echo [تم] اكتملت زراعة البيانات.
) else (
    echo تم تخطي زراعة البيانات.
)

echo.
echo ============================================================
echo  تمت المزامنة بنجاح!
echo ============================================================
pause
