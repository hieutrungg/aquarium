extends RefCounted
## Output positions are world-space feet, not sprite top-left corners.

const MAX_PROPS := 192
const TALL := ["rotala", "vallisneria"]
const LOW := ["carpet_grass", "moss"]
const PROP_SIZES := preload("res://scripts/tank/PropTextures.gd").SIZES


static func solve(dto: Dictionary, style: Dictionary, water: Rect2, ground: Callable) -> Array[Dictionary]:
	var generated := _automatic(dto, style, water, ground)
	var saved: Array = dto.get("scene", {}).get("props", [])
	var used: Dictionary = {}
	var fixed: Array[Dictionary] = []
	var pending: Array[Dictionary] = []
	for prop in generated:
		var match_index := -1
		for index in range(saved.size()):
			var source: Dictionary = saved[index]
			if used.has(index) or str(source.get("refType", "")) != prop.refType:
				continue
			if str(source.get("refId", "")) != prop.refId:
				continue
			# Without IDs, pair by asset key and occurrence for old desktop DTOs.
			if prop.refId.is_empty() and str(source.get("key", "")) != prop.key:
				continue
			match_index = index
			break
		if match_index < 0:
			pending.append(prop)
			continue
		used[match_index] = true
		var source: Dictionary = saved[match_index]
		var x := float(source.get("x", prop.position.x))
		prop.position = Vector2(x, float(source.get("y", float(ground.call(x)) + 2)))
		prop.layer = layer_name(prop.refType, str(source.get("layer", "mid")))
		prop.flip = bool(source.get("flip", false))
		fixed.append(prop)
	# Reserve all authored footprints before placing any new unit. If a row is
	# crowded, choose the least-overlapping slot rather than moving saved props.
	var reserved := fixed.duplicate()
	for prop in pending:
		if reserved.is_empty():
			fixed.append(prop)
			continue
		var best_x: float = prop.position.x
		var best_cost := INF
		for x in range(int(water.position.x + 16), int(water.end.x - 16), 4):
			var overlap := 0.0
			for obstacle in reserved:
				var gap := (Vector2(PROP_SIZES.get(prop.key, Vector2(48, 48))).x + Vector2(PROP_SIZES.get(obstacle.key, Vector2(48, 48))).x) / 2 + 4
				overlap += maxf(0, gap - absf(x - obstacle.position.x))
			var cost := overlap * 10000 + absf(x - prop.position.x)
			if cost < best_cost:
				best_cost = cost
				best_x = x
		prop.position = Vector2(best_x, float(ground.call(best_x)) + 2)
		fixed.append(prop)
	return fixed


static func layer_name(ref_type: String, band: String) -> String:
	var prefix := "Plants" if ref_type == "plant" else "Hardscape"
	if band in ["back", "background", "PlantsBack", "HardscapeBack"]:
		return prefix + "Back"
	if ref_type == "plant" and band in ["front", "foreground", "PlantsFront"]:
		return "PlantsFront"
	return prefix + "Mid"


static func serialize(props: Array[Dictionary]) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for prop in props:
		result.append({"refType": prop.refType, "refId": prop.refId, "key": prop.key,
			"x": roundi(prop.position.x), "y": roundi(prop.position.y),
			"layer": "back" if prop.layer.ends_with("Back") else ("front" if prop.layer.ends_with("Front") else "mid"),
			"flip": bool(prop.flip)})
	return result


static func _automatic(dto: Dictionary, style: Dictionary, water: Rect2, ground: Callable) -> Array[Dictionary]:
	var rng := RandomNumberGenerator.new()
	rng.seed = str(dto.get("tank", {}).get("id", "nature")).hash()
	var result: Array[Dictionary] = []
	var focal_ratio := 0.382 if rng.randf() < 0.5 else 0.618
	var focal := water.position.x + water.size.x * focal_ratio
	# Counterweight on the opposite golden point: driftwood and half of the midground plants go here.
	var counter := water.position.x + water.size.x * (1.0 - focal_ratio + (0.08 if focal_ratio < 0.5 else -0.08))
	var rocks: Array = dto.get("hardscape", [])
	var plants: Array = dto.get("plants", [])
	# Style defaults decorate demo/dev scenes only; a real tank shows exactly what its owner entered.
	var tank_id := str(dto.get("tank", {}).get("id", ""))
	var is_demo := tank_id.is_empty() or tank_id.begins_with("dev")
	if rocks.is_empty() and is_demo:
		rocks = style.get("defaults", {}).get("hardscape", [])
	if plants.is_empty() and is_demo:
		plants = style.get("defaults", {}).get("plants", [])
	var rock_index := 0
	for item: Dictionary in rocks:
		var is_wood: bool = item.get("type") in ["wood", "driftwood"]
		var key := str(item.get("spriteKey", "driftwood_branch" if is_wood else "seiryu_m"))
		for index in range(clampi(int(item.get("quantity", 1)), 0, MAX_PROPS - result.size())):
			if is_wood:
				var wood_x := clampf(counter + rng.randf_range(-10, 10), water.position.x + 66, water.end.x - 66)
				result.append(_prop(key, "hardscape", "HardscapeBack", wood_x, ground, rng, str(item.get("id", ""))))
				continue
			var x := focal
			if rock_index > 0:
				x += (-1.0 if rock_index % 2 else 1.0) * (32.0 + rock_index * 16.0) + rng.randf_range(-8, 8)
			x = clampf(x, water.position.x + 66, water.end.x - 66)
			var layer := "HardscapeBack" if item.get("position", "") == "background" else "HardscapeMid"
			result.append(_prop(key, "hardscape", layer, x, ground, rng, str(item.get("id", ""))))
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
			result.append(_prop(key, "plants", layer, x, ground, rng, str(item.get("id", ""))))
	return result


static func _plant_band(item: Dictionary) -> String:
	var key := str(item.get("plantKey", "java_fern"))
	if key in TALL:
		return "background"
	if key in LOW:
		return "foreground"
	return str(item.get("position", "midground"))


static func _prop(key: String, kind: String, layer: String, x: float, ground: Callable, rng: RandomNumberGenerator, ref_id: String) -> Dictionary:
	var snapped_x := roundf(x)
	return {"key": key, "kind": kind, "layer": layer, "refId": ref_id, "refType": "plant" if kind == "plants" else "hardscape",
		"position": Vector2(snapped_x, float(ground.call(snapped_x)) + 2),
		"flip": rng.randf() < 0.35, "phase": rng.randf_range(0, TAU)}
