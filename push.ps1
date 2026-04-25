param (
    [string]$msg = "update fitur"
)

Write-Host "Menambahkan file ke Git..." -ForegroundColor Cyan
git add .

Write-Host "Menyimpan perubahan (commit)..." -ForegroundColor Cyan
git commit -m $msg

Write-Host "Mengupload ke GitHub (push)..." -ForegroundColor Cyan
git push

Write-Host "Selesai! Vercel akan otomatis deploy." -ForegroundColor Green
