# FaceMyDealer Extension Icons

## Available Icons

SVG icons have been created and are ready to use:

- **icon16.svg** - 16x16px toolbar icon
- **icon48.svg** - 48x48px extension management  
- **icon128.svg** - 128x128px Chrome Web Store

## Converting to PNG (Required for Chrome)

Chrome Extension manifest requires PNG files. Convert SVGs to PNGs using one of these methods:

### Option 1: Online Converter
1. Go to https://svgtopng.com/
2. Upload each SVG file
3. Download as PNG at the correct size

### Option 2: Using ImageMagick (Command Line)
```bash
magick convert icon16.svg icon16.png
magick convert icon48.svg icon48.png
magick convert icon128.svg icon128.png
```

### Option 3: Using Inkscape
```bash
inkscape icon16.svg --export-filename=icon16.png --export-width=16
inkscape icon48.svg --export-filename=icon48.png --export-width=48
inkscape icon128.svg --export-filename=icon128.png --export-width=128
```

### Option 4: Browser DevTools
1. Open SVG in browser
2. Right-click > Inspect
3. Screenshot element at correct size

## Design Details

- **Colors**: Blue (#3b82f6) to Purple (#8b5cf6) gradient
- **Elements**: Car icon with Facebook badge
- **Style**: Modern rounded corners, clean design
- **Brand**: Matches FaceMyDealer web dashboard theme

## After Conversion

Once you have the PNG files, the extension will display proper icons in:
- Chrome toolbar
- Extensions page (chrome://extensions)
- Chrome Web Store listing
