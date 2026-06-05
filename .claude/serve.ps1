$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot   # repo root (parent of .claude)
$port = 8123
$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.webmanifest'='application/manifest+json';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'; '.map'='application/json'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port/"
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ct
      $ctx.Response.Headers.Add('Cache-Control','no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $nf = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $ctx.Response.OutputStream.Write($nf, 0, $nf.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
