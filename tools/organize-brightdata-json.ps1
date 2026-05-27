$SourceDir = "brightdata-downloads"
$BaseDir = "data\brightdata\raw"
$DatePrefix = "2026-05-27"

function Get-FirstRecord {
    param ($Json)

    if ($Json -is [System.Array]) {
        return $Json[0]
    }

    return $Json
}

function Get-UniquePath {
    param (
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return $Path
    }

    $directory = Split-Path $Path
    $filename = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    $extension = [System.IO.Path]::GetExtension($Path)

    $counter = 2

    do {
        $newPath = Join-Path $directory "$filename-$counter$extension"
        $counter++
    } while (Test-Path $newPath)

    return $newPath
}

if (-not (Test-Path $SourceDir)) {
    Write-Host "Source folder not found: $SourceDir"
    exit 1
}

Get-ChildItem $SourceDir -Filter "*.json" | ForEach-Object {
    $file = $_
    $raw = Get-Content $file.FullName -Raw

    try {
        $json = $raw | ConvertFrom-Json
    }
    catch {
        Write-Host "Invalid JSON skipped: $($file.Name)"
        return
    }

    $record = Get-FirstRecord $json

    $targetPath = $null

    # Error files
    if ($record.error_code) {
        $inputUrl = ""
        $inputDomain = ""
        $inputKeyword = ""

        if ($record.input) {
            $inputUrl = [string]$record.input.url
            $inputDomain = [string]$record.input.domain
            $inputKeyword = [string]$record.input.keyword
        }

        if ($inputUrl -like "*aliexpress*") {
            if ($record.error_code -eq "wait_element_timeout") {
                $targetPath = "$BaseDir\aliexpress\errors\$DatePrefix-aliexpress-collect-by-url-search-input.error.json"
            }
            elseif ($record.error_code -eq "dead_page") {
                $targetPath = "$BaseDir\aliexpress\errors\$DatePrefix-aliexpress-category-dead-page.error.json"
            }
            else {
                $targetPath = "$BaseDir\aliexpress\errors\$DatePrefix-aliexpress-runtime.error.json"
            }
        }
        elseif ($inputDomain -like "*tiktok.com/shop*" -or $inputKeyword) {
            $targetPath = "$BaseDir\tiktok\errors\$DatePrefix-tiktok-shop-discover-by-keyword.error.json"
        }
        elseif ($inputUrl -like "*tiktok.com/@*") {
            $targetPath = "$BaseDir\tiktok\errors\$DatePrefix-tiktok-posts-by-profile.error.json"
        }
        elseif ($inputUrl -like "*amazon.com/dp/ASIN*") {
            $targetPath = "$BaseDir\amazon\errors\$DatePrefix-amazon-invalid-asin.error.json"
        }
        else {
            $targetPath = "$BaseDir\amazon\errors\$DatePrefix-unknown-runtime.error.json"
        }
    }

    # Amazon Search results
    elseif ($record.asin -and $record.keyword -and $record.rank_on_page -ne $null) {
        $targetPath = "$BaseDir\amazon\search\$DatePrefix-amazon-products-search.raw.json"
    }

    # Amazon ASUS product detail
    elseif ($record.asin -eq "B0DZZWMB2L" -or $record.title -like "*ASUS ROG Strix G16*") {
        $targetPath = "$BaseDir\amazon\product-detail\$DatePrefix-amazon-product-detail-asus-rog-strix-g16.raw.json"
    }

    # Amazon product detail / global dataset sample
    elseif ($record.asin -and $record.product_details -and $record.domain -like "*amazon*") {
        $targetPath = "$BaseDir\amazon\global-dataset\$DatePrefix-amazon-global-dataset-sample.raw.json"
    }

    # eBay product detail
    elseif ($record.domain -like "*ebay.com*" -or $record.product_id -and $record.seller_rating) {
        $targetPath = "$BaseDir\ebay\product-detail\$DatePrefix-ebay-product-detail-sample.raw.json"
    }

    # AliExpress empty category result
    elseif ($record.input.url -like "*aliexpress*") {
        $targetPath = "$BaseDir\aliexpress\errors\$DatePrefix-aliexpress-category-empty-result.raw.json"
    }

    # Fallback
    else {
        $targetPath = "$BaseDir\amazon\errors\$DatePrefix-unclassified-brightdata-output.raw.json"
    }

    $targetPath = Get-UniquePath $targetPath

    New-Item -ItemType Directory -Path (Split-Path $targetPath) -Force | Out-Null
    Move-Item $file.FullName $targetPath

    Write-Host "Moved: $($file.Name) -> $targetPath"
}