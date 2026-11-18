extends RefCounted
## Shared botanical data; DTO placement overrides only rooted bands.

static var _plants: Dictionary = {}


static func all() -> Dictionary:
	if _plants.is_empty():
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/plants.json"))
		if parsed is Dictionary:
			_plants = parsed
	return _plants


static func profile(key: String) -> Dictionary:
	return all().get(key, {"band": "midground", "heightPx": 48, "sway": 1.0, "colorGroup": "green"})


static func band(item: Dictionary) -> String:
	var natural := str(profile(str(item.get("plantKey", "java_fern"))).band)
	if natural in ["floating", "epiphyte"]:
		return natural
	var requested := str(item.get("position", natural))
	return requested if requested in ["background", "midground", "foreground"] else natural
