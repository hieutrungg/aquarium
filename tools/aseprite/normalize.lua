-- Run after opening an input sprite with `aseprite -b <in.png>`.
local palettePath = app.params["palette"]
local outPath = app.params["out"]
local function fail(message)
  error("AquaVerse normalize: " .. message, 0)
end
if not palettePath or palettePath == "" then
  fail("Missing --script-param palette=<file.gpl>")
end
if not outPath or outPath == "" then
  fail("Missing --script-param out=<file.aseprite>")
end
if not outPath:lower():match("%.aseprite$") then
  fail("Output must have the .aseprite extension")
end
local sprite = app.activeSprite
if not sprite then fail("No active sprite; open an input PNG before --script") end
if not app.fs.isFile(palettePath) then fail("Palette file not found: " .. palettePath) end
local ok, palette = pcall(function() return Palette{ fromFile = palettePath } end)
if not ok then fail("Cannot load GPL palette: " .. tostring(palette)) end
sprite:setPalette(palette)
-- Use the supplied palette and disable dithering during RGB -> indexed mapping.
app.command.ChangePixelFormat{ format="indexed", dithering="none" }
if sprite.colorMode ~= ColorMode.INDEXED then fail("Could not convert sprite to indexed color") end
local saved, reason = pcall(function() sprite:saveAs(outPath) end)
if not saved then fail("Cannot save output: " .. tostring(reason)) end
print("AquaVerse normalize: saved " .. outPath)
