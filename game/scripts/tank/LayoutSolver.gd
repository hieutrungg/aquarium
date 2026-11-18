extends RefCounted
## Output positions are world-space feet, not sprite top-left corners.

const MAX_PROPS := 192
const Plants := preload("res://scripts/tank/PlantLibrary.gd")
const PROP_SIZES := preload("res://scripts/tank/PropTextures.gd").SIZES


static func solve(dto: Dictionary, style: Dictionary, water: Rect2, ground: Callable) -> Array[Dictionary]:
	var generated := _automatic(dto, style, water, ground)
	var saved: Array = dto.get("scene", {}).get("props", [])
	# Strict compositions must also remain valid when switching from another style.
	if style.get("layout_rule", "golden") in ["iwagumi", "dutch_streets"]:
		saved = []
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
		if prop.get("band", "") == "floating":
			fixed.append(prop)
			continue
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
	# Authored epiphytes retain their custom placement. Attach new units after
	# saved hardscape positions have been merged, so roots follow the real prop.
	for prop in pending:
		if prop.get("band", "") == "epiphyte":
			_attach(prop, fixed)
	for prop in fixed:
		if prop.get("band", "") == "floating":
			prop.layer = "Surface"
			prop.position.y = water.position.y + float(Plants.profile(prop.key).heightPx)
	return fixed


static func layer_name(ref_type: String, band: String) -> String:
	if ref_type == "plant" and band in ["floating", "Surface", "surface"]:
		return "Surface"
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
			"layer": "surface" if prop.layer == "Surface" else ("back" if prop.layer.ends_with("Back") else ("front" if prop.layer.ends_with("Front") else "mid")),
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
	var rule := str(style.get("layout_rule", "golden"))
	if rule == "dutch_streets":
		return _dutch(plants, style, water, ground, rng)
	if rule == "iwagumi":
		var stones: Array[Dictionary] = []
		for item: Dictionary in rocks:
			if _is_wood(item):
				continue
			for i in range(clampi(int(item.get("quantity", 1)), 0, 7)):
				stones.append(item)
		if not stones.is_empty():
			stones.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
				return Vector2(PROP_SIZES.get(str(a.get("spriteKey", "seiryu_m")), Vector2(64, 48))).y > Vector2(PROP_SIZES.get(str(b.get("spriteKey", "seiryu_m")), Vector2(64, 48))).y)
			var count := clampi(stones.size(), 3, 7)
			if count % 2 == 0:
				count = mini(7, count + 1)
			rocks = []
			for i in range(count):
				var stone: Dictionary = stones[mini(i, stones.size() - 1)].duplicate(true)
				stone.quantity = 1
				rocks.append(stone)
		else:
			rocks = []
		focal = water.position.x + water.size.x / 3.0
		plants = plants.duplicate(true)
		for item: Dictionary in plants:
			if _plant_band(item) == "foreground":
				var width := Vector2(PROP_SIZES.get(str(item.get("plantKey", "")), Vector2(64, 20))).x
				item.quantity = maxi(int(item.get("quantity", 1)), ceili(water.size.x / width))
				break
	var rock_index := 0
	for item: Dictionary in rocks:
		var is_wood := _is_wood(item)
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
			if rule == "iwagumi":
				result[-1]["lean"] = 0.0 if rock_index == 0 else (-0.12 if x > focal else 0.12)
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
		if band == "floating" and not style.get("floating_allowed", true):
			continue
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
			result[-1]["band"] = band
			if band == "floating":
				result[-1].position = Vector2(clampf(x, water.position.x + 36, water.end.x - 36), water.position.y + float(Plants.profile(key).heightPx))
				result[-1].layer = "Surface"
	return result


static func _plant_band(item: Dictionary) -> String:
	return Plants.band(item)


static func _is_wood(item: Dictionary) -> bool:
	return item.get("type") in ["wood", "driftwood"] or "wood" in str(item.get("spriteKey", ""))


static func _attach(plant: Dictionary, props: Array[Dictionary]) -> void:
	var nearest: Dictionary = {}
	var distance := INF
	for prop in props:
		if prop.refType != "hardscape":
			continue
		var d: float = absf(prop.position.x - plant.position.x)
		if d < distance:
			distance = d
			nearest = prop
	if nearest.is_empty():
		return
	var size := Vector2(PROP_SIZES.get(nearest.key, Vector2(64, 48)))
	var offset_x := clampf(plant.position.x - nearest.position.x, -size.x * 0.22, size.x * 0.22)
	plant.position = nearest.position + Vector2(roundf(offset_x), -roundf(size.y * 0.65))
	plant.layer = "PlantsBack" if nearest.layer == "HardscapeBack" else "PlantsMid"
	plant["attached_to"] = nearest.refId


static func _dutch(items: Array, style: Dictionary, water: Rect2, ground: Callable, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var groups: Dictionary = {}
	for item: Dictionary in items:
		var band := _plant_band(item)
		if band == "floating" and not style.get("floating_allowed", true):
			continue
		var color := str(Plants.profile(str(item.get("plantKey", "java_fern"))).colorGroup)
		if not groups.has(color):
			groups[color] = []
		for i in range(clampi(int(item.get("quantity", 1)), 0, MAX_PROPS)):
			if groups[color].size() < MAX_PROPS:
				groups[color].append(item)
	# One bed per species (Dutch "street" style), beds ordered so neighbouring colours contrast.
	var by_key: Dictionary = {}
	for color: String in groups:
		for item: Dictionary in groups[color]:
			var key := str(item.get("plantKey", "java_fern"))
			if not by_key.has(key):
				by_key[key] = {"color": color, "units": []}
			by_key[key].units.append(item)
	var by_color: Dictionary = {}
	for key: String in by_key:
		var color: String = by_key[key].color
		if not by_color.has(color):
			by_color[color] = []
		by_color[color].append(key)
	var color_order: Array = by_color.keys()
	color_order.sort()
	var beds: Array = []
	var remaining := true
	while remaining:
		remaining = false
		for color: String in color_order:
			if not by_color[color].is_empty():
				beds.append(by_color[color].pop_front())
				remaining = true
	var result: Array[Dictionary] = []
	# Carpets (foreground band) run along the front instead of taking a bed.
	var carpets: Array = beds.filter(func(k: String) -> bool: return _plant_band(by_key[k].units[0]) == "foreground")
	beds = beds.filter(func(k: String) -> bool: return not carpets.has(k))
	var street := 14.0
	var usable := water.size.x - 24.0 - street * 2.0
	var total_units := 0
	for key: String in beds:
		total_units += by_key[key].units.size()
	var cursor := water.position.x + 12.0
	for b in range(beds.size()):
		var units: Array = by_key[beds[b]].units
		var bed_width := usable * units.size() / maxf(1, total_units)
		# Two streets: after the beds that cross the 1/3 and 2/3 marks.
		var before := cursor - water.position.x
		var tall := float(Plants.profile(beds[b]).heightPx) > 64
		for i in range(units.size()):
			if result.size() >= MAX_PROPS:
				return result
			var x := cursor + bed_width * (i + 0.5) / units.size() + rng.randf_range(-3, 3)
			var layer := "PlantsBack" if tall else "PlantsMid"
			var prop := _prop(beds[b], "plants", layer, x, ground, rng, str(units[i].get("id", "")))
			prop.position.y -= 6 if tall else 0
			prop["colorGroup"] = by_key[beds[b]].color
			prop["band"] = _plant_band(units[i])
			result.append(prop)
		cursor += bed_width
		var after := cursor - water.position.x
		for mark in [water.size.x / 3.0, water.size.x * 2.0 / 3.0]:
			if before < mark and after >= mark:
				cursor += street
	for key: String in carpets:
		var units: Array = by_key[key].units
		for i in range(units.size()):
			if result.size() >= MAX_PROPS:
				return result
			var x := water.position.x + 20 + (water.size.x - 40) * (i + 0.5) / units.size()
			var prop := _prop(key, "plants", "PlantsFront", x, ground, rng, str(units[i].get("id", "")))
			prop["colorGroup"] = by_key[key].color
			prop["band"] = "foreground"
			result.append(prop)
	return result


static func _prop(key: String, kind: String, layer: String, x: float, ground: Callable, rng: RandomNumberGenerator, ref_id: String) -> Dictionary:
	var snapped_x := roundf(x)
	return {"key": key, "kind": kind, "layer": layer, "refId": ref_id, "refType": "plant" if kind == "plants" else "hardscape",
		"position": Vector2(snapped_x, float(ground.call(snapped_x)) + 2),
		"flip": rng.randf() < 0.35, "phase": rng.randf_range(0, TAU)}
