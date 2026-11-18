extends RefCounted
## Style files are data, never executable paths supplied by the host page.

const NATURE := {
	"key": "nature",
	"substrate": {"tile": "sand_fine", "back_height": 40, "front_height": 22, "curve": 3,
		"fill": "#E8D9B5", "grain": "#CDB98F", "rim": "#F4ECD6"},
	"colors": {"wall": "#76B5A5", "water": "#B8E1D5", "light": "#D6F0E8",
		"wood": "#8B6B4E", "wood_shadow": "#6B5241", "ink": "#35574F"},
	"effects": {"caustics": true, "god_rays": true, "bubbles": true, "particles": true},
	"sway": 2.0, "current": 0.0, "turbidity": 0.0,
	"defaults": {
		"hardscape": [{"spriteKey": "seiryu_l", "quantity": 1},
			{"spriteKey": "seiryu_m", "quantity": 1}, {"spriteKey": "seiryu_s", "quantity": 1},
			{"spriteKey": "driftwood_branch", "quantity": 1, "position": "background"}],
		"plants": [{"plantKey": "vallisneria", "position": "background", "quantity": 4},
			{"plantKey": "rotala", "position": "background", "quantity": 5},
			{"plantKey": "java_fern", "position": "midground", "quantity": 3},
			{"plantKey": "anubias", "position": "midground", "quantity": 3},
			{"plantKey": "carpet_grass", "position": "foreground", "quantity": 8},
			{"plantKey": "moss", "position": "foreground", "quantity": 3}]
	}
}


static func load_style(key: String) -> Dictionary:
	var result: Dictionary = NATURE.duplicate(true)
	_merge(result, _read("nature"))
	if key != "nature" and key.is_valid_filename() and not key.contains("."):
		_merge(result, _read(key))
	return result


static func _read(key: String) -> Dictionary:
	var path := "res://data/styles/%s.json" % key
	if not FileAccess.file_exists(path):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}


static func _merge(target: Dictionary, source: Dictionary) -> void:
	for key: Variant in source:
		if source[key] is Dictionary and target.get(key) is Dictionary:
			_merge(target[key], source[key])
		else:
			target[key] = source[key]
