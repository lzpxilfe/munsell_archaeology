/**
 * Munsell Archaeology Color Tool - 8-bit Pixel Icons Library
 * Provides retro pixel art SVG replacements for UI emojis.
 */

(function(global) {
  const PALETTE = {
    '.': 'transparent',
    'k': '#1a1714', // Outline/Dark
    'w': '#ffffff', // White
    'g': 'var(--accent-gold, #c49a4e)', // Gold
    'c': 'var(--accent-clay, #a05c38)', // Clay
    's': 'var(--accent-sand, #d4c090)', // Sand
    'b': '#3498db', // Blue
    'r': '#e74c3c', // Red
    'y': '#f1c40f', // Yellow
    'o': '#e67e22', // Orange
    'e': 'var(--accent-green, #5a8c68)', // Green (leaves)
    'l': '#bdc3c7', // Light Gray
    'd': '#7f8c8d', // Dark Gray
    'p': '#9b59b6', // Purple
    'v': '#95a5a6', // Silver/Light Gray
  };

  const GRIDS = {
    // 🏺 Amphora/Logo
    '🏺': [
      ".....kkkkkk.....",
      "....kcccccck....",
      "...kccggggcck...",
      "...kccggggcck...",
      "....kcccccck....",
      "...kkcccccckk...",
      "..kcccccccccck..",
      ".kcccccccccccck.",
      "kccccsggscccccck",
      "kccccsggscccccck",
      "kccccsggscccccck",
      ".kcccccccccccck.",
      "..kcccccccccck..",
      "...kcccccccck...",
      "....kkkkkkkk....",
      "................"
    ],
    // 💉 Syringe/Eyedropper
    '💉': [
      "...........kk...",
      "..........kllk..",
      ".........kllkk..",
      "........kwwk.k..",
      ".......kwwk.k...",
      "......kbbk.k....",
      ".....kbbk.k.....",
      "....kbbk.k......",
      "...krrk.k.......",
      "..kkkk.k........",
      ".k..k.k.........",
      "k..kkk..........",
      "..k.............",
      "................",
      "................",
      "................"
    ],
    // 🌙 Moon (Theme Toggle)
    '🌙': [
      "....kkkk........",
      "...kyyyykkk.....",
      "..kyyyyyyyk.....",
      ".kyyyyykkkk.....",
      "kyyyyk..........",
      "kyyyk...........",
      "kyyyk...........",
      "kyyyk...........",
      "kyyyk...........",
      "kyyyyk..........",
      ".kyyyyykkkk.....",
      "..kyyyyyyyk.....",
      "...kyyyykkk.....",
      "....kkkk........",
      "................",
      "................"
    ],
    // ☀️ Sun (Theme Toggle, Clear sky)
    '☀️': [
      ".......kk.......",
      "....k..kk..k....",
      ".....kooook.....",
      "....kooyyook....",
      "kk.koyyyyyyok.kk",
      "kk.koyyyyyyok.kk",
      "....kooyyook....",
      ".....kooook.....",
      "....k..kk..k....",
      ".......kk.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    '☀': [
      ".......kk.......",
      "....k..kk..k....",
      ".....kooook.....",
      "....kooyyook....",
      "kk.koyyyyyyok.kk",
      "kk.koyyyyyyok.kk",
      "....kooyyook....",
      ".....kooook.....",
      "....k..kk..k....",
      ".......kk.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    // 🌤️ Sun Behind Small Cloud
    '🌤️': [
      ".....kkkk.......",
      "....kyyyyk.k....",
      "...kyyyyyyk.....",
      "..kyyyyyyyyk....",
      "..kyykkkkkkkk...",
      ".kyykwwwwwwwwk..",
      ".kykwwwwwwwwwwk.",
      "kkkwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      ".kwwwwwwwwwwwwk.",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................"
    ],
    '🌤': [
      ".....kkkk.......",
      "....kyyyyk.k....",
      "...kyyyyyyk.....",
      "..kyyyyyyyyk....",
      "..kyykkkkkkkk...",
      ".kyykwwwwwwwwk..",
      ".kykwwwwwwwwwwk.",
      "kkkwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      ".kwwwwwwwwwwwwk.",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................"
    ],
    // ☁️ Cloud (Overcast)
    '☁️': [
      "................",
      "......kkkk......",
      "....kkwwwwkk....",
      "...kwwwwwwwwk...",
      "..kwwwwwwwwwwk..",
      ".kwwwwwwwwwwwwk.",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      ".kwwwwwwwwwwwwk.",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    '☁': [
      "................",
      "......kkkk......",
      "....kkwwwwkk....",
      "...kwwwwwwwwk...",
      "..kwwwwwwwwwwk..",
      ".kwwwwwwwwwwwwk.",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      ".kwwwwwwwwwwwwk.",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    // 🌿 Herb/Plant (Shade)
    '🌿': [
      "........kk......",
      ".......keek.....",
      "......keeeek....",
      "....kkkeeeek....",
      "...keeeekeeek...",
      "..keeeeeeeekk...",
      "..keeeeeeeek....",
      "...kkkeeeek.....",
      "....k.keeeek....",
      "....k..keek.....",
      "....k...kk......",
      "....k...........",
      "....k...........",
      "....k...........",
      "....k...........",
      "................"
    ],
    // 🔆 LED
    '🔆': [
      "......kkkk......",
      "....kkwwwwkk....",
      "...kwwwwwwwwk...",
      "..kwwwwwwwwwwk..",
      "..kwwyyyyyywwk..",
      "..kwwyyyyyywwk..",
      "..kwwyyyyyywwk..",
      "..kwwyyyyyywwk..",
      "..kwwwwwwwwwwk..",
      "...kwwwwwwwwk...",
      "....kkwwwwkk....",
      "......kkkk......",
      "......kkkk......",
      "......k..k......",
      "......k..k......",
      "................"
    ],
    // 💡 Light bulb (Tungsten)
    '💡': [
      "......kkkk......",
      "....kkyyyykk....",
      "...kyyyyyyyyk...",
      "..kyyywyywyyyk..",
      "..kyyywyywyyyk..",
      "..kyyyyyyyyyyk..",
      "...kyyyyyyyyk...",
      "....kkyyyykk....",
      ".....kllllk.....",
      ".....kddddk.....",
      ".....kllllk.....",
      "......kddk......",
      ".......kk.......",
      "................",
      "................",
      "................"
    ],
    // ⚖️ Balance Scale
    '⚖️': [
      ".......kk.......",
      "....kkkkkkkk....",
      "...k...kk...k...",
      "..kk...kk...kk..",
      ".k.k...kk...k.k.",
      "kk.k...kk...k.kk",
      "k..k...kk...k..k",
      "kkkk...kk...kkkk",
      ".......kk.......",
      ".......kk.......",
      ".......kk.......",
      ".......kk.......",
      ".....kkkkkk.....",
      "....kkkkkkkk....",
      "................",
      "................"
    ],
    '⚖': [
      ".......kk.......",
      "....kkkkkkkk....",
      "...k...kk...k...",
      "..kk...kk...kk..",
      ".k.k...kk...k.k.",
      "kk.k...kk...k.kk",
      "k..k...kk...k..k",
      "kkkk...kk...kkkk",
      ".......kk.......",
      ".......kk.......",
      ".......kk.......",
      ".......kk.......",
      ".....kkkkkk.....",
      "....kkkkkkkk....",
      "................",
      "................"
    ],
    // 🖼️ Picture Frame
    '🖼️': [
      "kkkkkkkkkkkkkkkk",
      "kcccccccccccccck",
      "kcbbbbbbbbbbbbck",
      "kcbbbyybbbbbbbck",
      "kcbbbyybbbbbbbck",
      "kcbbbbbbbbbbbbck",
      "kcbbbbbbbbeeeeck",
      "kcbbbbbbbeeeecck",
      "kcbbbbbbeeeeecck",
      "kcbeeeeeeeeeecck",
      "kceeeeeeeeeeecck",
      "kceeeeeeeeeeecck",
      "kcccccccccccccck",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................"
    ],
    '🖼': [
      "kkkkkkkkkkkkkkkk",
      "kcccccccccccccck",
      "kcbbbbbbbbbbbbck",
      "kcbbbyybbbbbbbck",
      "kcbbbyybbbbbbbck",
      "kcbbbbbbbbbbbbck",
      "kcbbbbbbbbeeeeck",
      "kcbbbbbbbeeeecck",
      "kcbbbbbbeeeeecck",
      "kcbeeeeeeeeeecck",
      "kceeeeeeeeeeecck",
      "kceeeeeeeeeeecck",
      "kcccccccccccccck",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................"
    ],
    // 📁 Folder
    '📁': [
      "................",
      "....kkkkk.......",
      "...kyyyyykkkkkk.",
      "..kyyyyyyyyyyyk.",
      ".kyyyyyyyyyyyyk.",
      "kkkkkkkkkkkkkkk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "ksssssssssssssk.",
      "kkkkkkkkkkkkkkk.",
      "................",
      "................"
    ],
    // 💧 Droplet (Eyedropper mode)
    '💧': [
      ".......kk.......",
      "......kbbk......",
      "......kbbk......",
      ".....kbbbbk.....",
      ".....kbbbbk.....",
      "....kbwbbbbk....",
      "....kbwbbbbk....",
      "...kbwwbbbbbk...",
      "...kbwwbbbbbk...",
      "..kbwwbbbbbbbk..",
      "..kbbbbbbbbbbk..",
      "...kbbbbbbbbk...",
      "....kbbbbbbk....",
      ".....kkkkkk.....",
      "................",
      "................"
    ],
    // ▭ Rectangle (Selection tool)
    '▭': [
      "kkkkkkkkkkkkkkkk",
      "keeeeeeeeeeeeeek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "ke............ek",
      "keeeeeeeeeeeeeek",
      "kkkkkkkkkkkkkkkk",
      "................"
    ],
    // ✎ Pencil/Lasso tool
    '✎': [
      "............kk..",
      "...........krrk.",
      "..........kllk..",
      ".........kyyk...",
      "........kyyk....",
      ".......kyyk.....",
      "......kyyk......",
      ".....kyyk.......",
      "....kyyk........",
      "...kyyk.........",
      "..kllk..........",
      ".kkkk...........",
      "kk..............",
      "................",
      "................",
      "................"
    ],
    // 📐 Polyline tool / Ruler
    '📐': [
      "kkkkkkkkkkkkkkkk",
      "kyyyyyyyyyyyyyyk",
      "ky.k.k.k.k.k.k.k",
      "ky............kk",
      "ky...........k..",
      "ky.k........k...",
      "ky.........k....",
      "ky.k......k.....",
      "ky.......k......",
      "ky.k....k.......",
      "ky.....k........",
      "ky.k..k.........",
      "ky...k..........",
      "ky..k...........",
      "kykk............",
      "kk.............."
    ],
    // ⬜ White card (Graycard tool)
    '⬜': [
      "kkkkkkkkkkkkkkkk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwkwwwwwwwk",
      "kwwwwwkkkwwwwwwk",
      "kwwwwwwkwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kwwwwwwwwwwwwwwk",
      "kkkkkkkkkkkkkkkk",
      "................"
    ],
    // ✋ Hand (Pan tool)
    '✋': [
      "......kk........",
      "....kksskk..kk..",
      "....kssssskksk..",
      "....kssssssssk..",
      "....kssssssssk..",
      "....kssssssssk..",
      "....kssssssssk..",
      "..kkkssssssssk..",
      ".ksssssssssssk..",
      "kssssssssssssk..",
      "kssssssssssssk..",
      ".kssssssssssk..",
      "..kssssssssk....",
      "...kkkkkkkk.....",
      "................",
      "................"
    ],
    // 🌡️ Thermometer
    '🌡️': [
      "......kkk.......",
      ".....kwwk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      "....kwwrwk......",
      "...kwwrrrwwk....",
      "...kwrrrrrwk....",
      "...kwrrrrrwk....",
      "....kwrrrwk.....",
      ".....kkkkk......",
      "................",
      "................",
      "................"
    ],
    '🌡': [
      "......kkk.......",
      ".....kwwk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      ".....kwrk.......",
      "....kwwrwk......",
      "...kwwrrrwwk....",
      "...kwrrrrrwk....",
      "...kwrrrrrwk....",
      "....kwrrrwk.....",
      ".....kkkkk......",
      "................",
      "................",
      "................"
    ],
    // 🎨 Palette (Munsell result)
    '🎨': [
      ".....kkkkkk.....",
      "..kkksswwsskk...",
      ".ksssssswwsssk..",
      "kssrrsssssssssk.",
      "kssrrssyyyyyssk.",
      "kssssssyyyyyssk.",
      "ksssssssssssssk.",
      ".kssbbssssssssk.",
      ".kssbbssseeesk..",
      "..ksssssseeesk..",
      "...kkksssssk....",
      "......kkkkk.....",
      "................",
      "................",
      "................",
      "................"
    ],
    // 📋 Clipboard (Copy)
    '📋': [
      "......kkkk......",
      "....kdlllldk....",
      "..kkkdlllldkkk..",
      ".kccccccccccck.",
      ".kccwwwwwwwcck.",
      ".kccwddwwddwcck.",
      ".kccwwwwwwwcck.",
      ".kccwddwwddwcck.",
      ".kccwwwwwwwcck.",
      ".kccwddwwddwcck.",
      ".kccwwwwwwwcck.",
      ".kccwddwwddwcck.",
      ".kccwwwwwwwcck.",
      ".kccccccccccck.",
      "..kkkkkkkkkkk..",
      "................"
    ],
    // 📌 Pushpin (Pin marker)
    '📌': [
      ".........kkkk...",
      "........krrrsk..",
      ".......krrrrsk..",
      "......krrrrsk...",
      ".....kkkkkkk....",
      "......klllk.....",
      ".....klllk......",
      "....klllk.......",
      "...klllk........",
      "..klllk.........",
      ".kkkk...........",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    // 🗂️ Folders/Layers
    '🗂️': [
      "................",
      "....kkk..kkk....",
      "...krrrkkeeek...",
      "..krrrrrkeeeek..",
      ".kkkkkkkkkkkkkk.",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................",
      "................"
    ],
    '🗂': [
      "................",
      "....kkk..kkk....",
      "...krrrkkeeek...",
      "..krrrrrkeeeek..",
      ".kkkkkkkkkkkkkk.",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbbbbbbbbbk",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................",
      "................"
    ],
    // 🗑 Trash bin
    '🗑': [
      ".....kkkkkk.....",
      "....kddddddk....",
      "..kkkkkkkkkkkk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "..kdllldlllddk..",
      "...kddddddddk...",
      "....kkkkkkkk....",
      "................",
      "................"
    ],
    // 🗺 Map (Layer boundaries toggle)
    '🗺': [
      "kkkkkkkkkkkkkkkk",
      "ksssseessssseesk",
      "ksseeeesssseeesk",
      "kseeeeesssseeesk",
      "kseeeesssssseesk",
      "kssseessssseeeek",
      "kssseessssseeeek",
      "kssseessssseeeek",
      "ksssseesssseeesk",
      "ksseeeesssseeesk",
      "kseeeeesssseeesk",
      "kseeeesssssseesk",
      "kssssssssssssssk",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................"
    ],
    // 📄 CSV/Document
    '📄': [
      ".....kkkkkkkk...",
      "....kwwwwwdvk...",
      "...kwwwwwdvvk...",
      "..kwwkkkkkkkk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kkkkkkkkkkk...",
      "................",
      "................",
      "................"
    ],
    // 💾 Floppy/JSON
    '💾': [
      "kkkkkkkkkkkkkkk.",
      "kbbbbbbbbbbbbdkk",
      "kbbbbbbbbbbbddkk",
      "kbbwwwwwwwwbddk.",
      "kbbwbbbbbbwbddk.",
      "kbbwbbbbbbwbddk.",
      "kbbwbbbbbbwbddk.",
      "kbbwwwwwwwwbddk.",
      "kbbbbbbbbbbbddk.",
      "kbbbbbbbbbbbddk.",
      "kbblllkklllbddk.",
      "kbblllkklllbddk.",
      "kbblllkklllbddk.",
      "kkkkkkkkkkkkkkk.",
      "................",
      "................"
    ],
    // 🔖 Bookmark (Soil ref header)
    '🔖': [
      "....kkkkkkk.....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krrrrrrrk....",
      "...krkkkkkrk....",
      "....k.....k.....",
      "................"
    ],
    // 📸 Camera (Photography guide)
    '📸': [
      "................",
      "......kkkk......",
      ".....kyyyyk.....",
      "....kkkkkkkk....",
      "...kddddddddk...",
      "..kddvvvvvvddk..",
      ".kdvvbbbbbbvvkk.",
      "kddvbbkkkkbbvdkk",
      "kddvbbkkkkbbvdk.",
      ".kdvvbbbbbbvvdk.",
      "..kddvvvvvvddk..",
      "...kddddddddk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................"
    ],
    // 📷 Camera (Vignette guide tab)
    '📷': [
      "................",
      "......kkkk......",
      ".....kyyyyk.....",
      "....kkkkkkkk....",
      "...kddddddddk...",
      "..kddvvvvvvddk..",
      ".kdvvbbbbbbvvkk.",
      "kddvbbkkkkbbvdkk",
      "kddvbbkkkkbbvdk.",
      ".kdvvbbbbbbvvdk.",
      "..kddvvvvvvddk..",
      "...kddddddddk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................"
    ],
    // 🏁 Chequered Flag (24-patch Macbeth)
    '🏁': [
      ".....kk.........",
      "....kwkkkkkkkk..",
      "....kwkwkwkwkkk.",
      "....kkkkkkkkkkk.",
      "....kwkwkwkwkkk.",
      "....kkkkkkkkkkk.",
      "....kwkwkwkwkkk.",
      "....kkkkkkkk....",
      "....kd..........",
      "....kd..........",
      "....kd..........",
      "....kd..........",
      "....kd..........",
      "....kd..........",
      "....kk..........",
      "................"
    ],
    // 📚 Books (Floating science guide)
    '📚': [
      "......kkkkkkk...",
      ".....krrrrrrrk..",
      "....krrrrrrrkww.",
      "...kkkkkkkkkkw..",
      "...kbbbbbbbbk...",
      "..kbbbbbbbbkww..",
      ".kkkkkkkkkkkw...",
      ".kyyyyyyyyk.....",
      "kyyyyyyyykww....",
      "kkkkkkkkkkk.....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    // 📍 Location Pin (Point Marker)
    '📍': [
      "......kkkk......",
      "....kkrrrskk....",
      "...krrrrrrrwk...",
      "..krrrrrrrrrwk..",
      "..krrrrrrrrrwk..",
      "..krrrrrrrrrwk..",
      "...krrrrrrrwk...",
      "....kkrrrwkk....",
      "......kllk......",
      "......kllk......",
      "......kllk......",
      "......kllk......",
      "......kllk......",
      "......kkkk......",
      "................",
      "................"
    ],
    // 📝 Memo/Notes
    '📝': [
      ".....kkkkkkkk...",
      "....kwwwwwwdk...",
      "...kwwwwwwddk...",
      "..kwwkkkkkkkk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kwwddwddwwk...",
      "..kwwwwwwwwwk...",
      "..kkkkkkkkkkk...",
      ".........kk.....",
      "........kyyk....",
      ".......kyyk.....",
      "......kllk......",
      ".....kk........."
    ],
    // 🎯 Target (Calibration)
    '🎯': [
      "......kkkk......",
      "....kkrrrrkk....",
      "...krrrrrrrrk...",
      "..krrwwwwwwrrk..",
      "..krwwrrrrwwrk..",
      ".krwrrwwywwrrwk.",
      ".krwrrwywyywrrwk",
      ".krwrrwwywwrrwk.",
      "..krwwrrrrwwrk..",
      "..krrwwwwwwrrk..",
      "...krrrrrrrrk...",
      "....kkrrrrkk....",
      "......kkkk......",
      "................",
      "................",
      "................"
    ],
    // ✕ Close/Clear
    '✕': [
      "kk...........kk.",
      "kkk.........kkk.",
      ".kkk.......kkk..",
      "..kkk.....kkk...",
      "...kkk...kkk....",
      "....kkk.kkk.....",
      ".....kkkkk......",
      "......kkk.......",
      ".....kkkkk......",
      "....kkk.kkk.....",
      "...kkk...kkk....",
      "..kkk.....kkk...",
      ".kkk.......kkk..",
      "kkk.........kkk.",
      "kk...........kk.",
      "................"
    ],
    // ✓ Success/Checkmark
    '✓': [
      "..............ee",
      ".............eee",
      "............eee.",
      "...........eee..",
      "..ee......eee...",
      ".eeee....eee....",
      "eeeeee..eee.....",
      "ee.eeeeeee......",
      "e...eeeee.......",
      ".....eee........",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ],
    // ✏️ Lasso pencil variant
    '✏️': [
      "............kk..",
      "...........krrk.",
      "..........kllk..",
      ".........kyyk...",
      "........kyyk....",
      ".......kyyk.....",
      "......kyyk......",
      ".....kyyk.......",
      "....kyyk........",
      "...kyyk.........",
      "..kllk..........",
      ".kkkk...........",
      "kk..............",
      "................",
      "................",
      "................"
    ]
  };

  const cache = {};

  // Build the SVG code from the grid representation
  function compileSvg(emoji, grid) {
    const size = 16;
    let svg = `<svg viewBox="0 0 ${size} ${size}" class="pixel-icon" data-emoji="${emoji}" shape-rendering="crispEdges">`;
    
    for (let y = 0; y < size; y++) {
      const row = grid[y];
      let startX = 0;
      while (startX < size) {
        const char = row[startX];
        if (char === '.' || !PALETTE[char]) {
          startX++;
          continue;
        }
        let endX = startX;
        while (endX < size && row[endX] === char) {
          endX++;
        }
        const width = endX - startX;
        const color = PALETTE[char];
        svg += `<rect x="${startX}" y="${y}" width="${width}" height="1" fill="${color}"/>`;
        startX = endX;
      }
    }
    svg += `</svg>`;
    return svg;
  }

  // Helper to clean up variations
  function cleanEmoji(str) {
    return str.replace(/\ufe0f/g, '').trim();
  }

  const PixelIcons = {
    grids: GRIDS,
    
    // Get compiled SVG for a single emoji
    get: function(emoji) {
      if (!emoji) return '';
      const clean = cleanEmoji(emoji);
      if (cache[clean]) return cache[clean];
      
      const grid = GRIDS[clean];
      if (grid) {
        cache[clean] = compileSvg(clean, grid);
        return cache[clean];
      }
      
      // Fallback to original emoji if not mapped
      return emoji;
    },

    // Replace all emojis in a text string
    replace: function(text) {
      if (typeof text !== 'string') return text;
      let result = text;
      
      // Sort keys descending by length to replace longer variants first
      const sortedKeys = Object.keys(GRIDS).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        // Match base emoji with optional variation selectors
        const escaped = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escaped + '\\ufe0f?', 'g');
        if (regex.test(result)) {
          result = result.replace(regex, this.get(key));
        }
      }
      return result;
    },

    // Recursively traverse and replace emojis in text nodes within a container
    replaceInDOM: function(element) {
      if (!element) return;
      const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while (node = walk.nextNode()) {
        textNodes.push(node);
      }
      
      for (const node of textNodes) {
        const parent = node.parentNode;
        if (!parent) continue;
        
        // Skip elements where we shouldn't execute rendering
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'code' || tag === 'pre' || tag === 'svg' || tag === 'option' || tag === 'select' || tag === 'title' || parent.closest('.pixel-icon')) {
          continue;
        }

        const val = node.nodeValue;
        let hasEmoji = false;
        for (const key of Object.keys(GRIDS)) {
          if (val.includes(key)) {
            hasEmoji = true;
            break;
          }
        }
        
        if (hasEmoji) {
          const span = document.createElement('span');
          span.className = 'pixel-icon-container';
          span.innerHTML = this.replace(val);
          parent.replaceChild(span, node);
        }
      }
    }
  };

  global.PixelIcons = PixelIcons;
})(window);
