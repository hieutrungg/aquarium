extends RefCounted
## DTO speed is the existing dimensionless multiplier; profile speed is px/s.
static var _profiles: Dictionary = {}

static func resolve(key: String, render: Dictionary = {}) -> Dictionary:
	if _profiles.is_empty():
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/species_profiles.json"))
		if parsed is Dictionary:
			_profiles = parsed
	var result: Dictionary = _profiles.get(key, _profiles.get("guppy", {})).duplicate(true)
	result.merge(render, true)
	result.speed = float(_profiles.get(key, _profiles.get("guppy", {})).get("speed", 22)) * maxf(0.05, float(render.get("speed", 1)))
	return result
