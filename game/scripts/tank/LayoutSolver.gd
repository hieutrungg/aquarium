extends RefCounted
## Output positions are world-space feet, not sprite top-left corners.

const MAX_PROPS := 192
const TALL := ["rotala", "vallisneria"]
const LOW := ["carpet_grass", "moss"]


static func solve(dto: Dictionary, style: Dictionary, water: Rect2, ground: Callable) -> Array[Dictionary]:
	var rng := RandomNumberGenerator.new()
	rng.seed = str(dto.get("tank", {}).get("id", "nature")).hash()
	var authored: Array = dto.get("scene", {}).get("props", [])
	if not authored.is_empty():
		return _authored(authored, dto, water, ground)
	var result: Array[Dictionary] = []
	var focal_ratio := 0.382 if rng.randf() < 0.5 else 0.618
	var focal := water.position.x + water.size.x * focal_ratio
	# Counterweight on the opposite golden point: driftwood and half of the midground plants go here.
	var counter := water.position.x + water.size.x * (1.0 - focal_ratio + (0.08 if focal_ratio < 0.5 else -0.08))
	var rocks: Array = dto.get("hardscape", [])
	var plants: Array = dto.get("plants", [])
	if rocks.is_empty():
		rocks = style.get("defaults", {}).get("hardscape", [])
	if plants.is_empty():
		plants = style.get("defaults", {}).get("plants", [])
	var rock_index := 0
	for item: Dictionary in rocks:
		var is_wood: bool = item.get("type") in ["wood", "driftwood"]
		var key := str(item.get("spriteKey", "driftwood_branch" if is_wood else "seiryu_m"))
		for index in range(clampi(int(item.get("quantity", 1)), 0, MAX_PROPS - result.size())):
			if is_wood:
				var wood_x := clampf(counter + rng.randf_range(-10, 10), water.position.x + 66, water.end.x - 66)
				result.append(_prop(key, "hardscape", "HardscapeBack", wood_x, ground, rng))
				continue
			var x := focal
			if rock_index > 0:
				x += (-1.0 if rock_index % 2 else 1.0) * (32.0 + rock_index * 16.0) + rng.randf_range(-8, 8)
			x = clampf(x, water.position.x + 66, water.end.x - 66)
			var layer := "HardscapeBack" if item.get("position", "") == "background" else "HardscapeMid"
			result.append(_prop(key, "hardscape", layer, x, ground, rng))
			rock_index += 1
	var front_total := 0
	var back_total := 0
	for item: Dictionary in plants:
		if _plant_band(item) == "foreground":
			front_total += clampi(int(item.get("quantity", 1)), 0, MAX_PROPS)
		elif _plant_band(item) == "background":
			back_total += clampi(int(item.get("quantity", 1)), 0, MAX_PROPS)
	var front_index := 0
	var back_index := 0
	var mid_index := 0
	for item: Dictionary in plants:
		var key := str(item.get("plantKey", "java_fern"))
		var band := _plant_band(item)
		for index in range(clampi(int(item.get("quantity", 1)), 0, MAX_PROPS - result.size())):
			var x: float
			var layer := "PlantsMid"
			if band == "background":
				layer = "PlantsBack"
				# Spread the back row across the whole tank so it frames the scene.
				x = water.position.x + (back_index + 0.5) * water.size.x / maxf(1, back_total) + rng.randf_range(-14, 14)
				back_index += 1
			elif band == "foreground":
				layer = "PlantsFront"
				x = water.position.x + (front_index + 0.5) * water.size.x / maxf(1, front_total)
				front_index += 1
			else:
				# Alternate midground clumps between the stone (focal) and the counterweight.
				var anchor := focal if mid_index % 2 == 0 else counter
				x = anchor + rng.randf_range(-70, 70)
				mid_index += 1
			x = clampf(x, water.position.x + 34, water.end.x - 34)
			result.append(_prop(key, "plants", layer, x, ground, rng))
	return result


static func _plant_band(item: Dictionary) -> String:
	var key := str(item.get("plantKey", "java_fern"))
	if key in TALL:
		return "background"
	if key in LOW:
		return "foreground"
	return str(item.get("position", "midground"))


static func _prop(key: String, kind: String, layer: String, x: float, ground: Callable, rng: RandomNumberGenerator) -> Dictionary:
	var snapped_x := roundf(x)
	return {"key": key, "kind": kind, "layer": layer,
		"position": Vector2(snapped_x, float(ground.call(snapped_x)) + 2),
		"flip": rng.randf() < 0.35, "phase": rng.randf_range(0, TAU)}


static func _authored(props: Array, dto: Dictionary, water: Rect2, ground: Callable) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for source: Dictionary in props.slice(0, MAX_PROPS):
		var kind := "plants" if str(source.get("refType", "plant")) in ["plant", "plants"] else "hardscape"
		var item: Dictionary = source
		for candidate: Dictionary in dto.get(kind, []):
			if str(candidate.get("id", candidate.get("_id", ""))) == str(source.get("refId", "?")):
				item = candidate
				break
		var key := str(source.get("spriteKey", source.get("plantKey", source.get("key",
			item.get("plantKey", item.get("spriteKey", "java_fern" if kind == "plants" else "seiryu_m"))))))
		var band := str(source.get("layer", "midground"))
		var layer := ("Plants" if kind == "plants" else "Hardscape") + ("Back" if band in ["background", "back", "PlantsBack", "HardscapeBack"] else "Mid")
		if kind == "plants" and band in ["foreground", "front", "PlantsFront"]:
			layer = "PlantsFront"
		var x := roundf(float(source.get("x", water.get_center().x)))
		# An explicit y is an authored foot (e.g. an epiphyte on wood); omit y to ground it.
		var y := roundf(float(source.get("y", float(ground.call(x)) + 2)))
		result.append({"key": key, "kind": kind, "layer": layer, "position": Vector2(x, y),
			"flip": bool(source.get("flip", false)), "phase": float(result.size()) * 1.73})
	return result
