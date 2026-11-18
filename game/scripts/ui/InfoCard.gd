extends PanelContainer
var species_key := ""
var species_slug: Variant = null
var displayed_fish: Node2D

func _ready() -> void:
	$Margin/Content/Details.pressed.connect(func() -> void:
		get_node("/root/Bridge").send("open:species", {"speciesKey": species_key, "speciesSlug": species_slug}))

func show_fish(fish: Node2D, water: Dictionary) -> void:
	displayed_fish = fish
	species_key = fish.species_key
	species_slug = fish.dto.get("speciesSlug")
	var profile: Dictionary = fish.profile.duplicate(true)
	for key in ["nameVi", "sciName", "tempRange", "phRange"]:
		var value: Variant = fish.dto.get(key)
		if value != null and (not value is String or not value.is_empty()):
			profile[key] = value
	for key in ["tempRange", "phRange"]:
		if profile[key] is Dictionary:
			profile[key] = [profile[key].get("min", 0), profile[key].get("max", 100)]
	$Margin/Content/Name.text = str(profile.nameVi)
	$Margin/Content/Science.text = str(profile.sciName)
	var zones := PackedStringArray()
	for zone: String in profile.swimZone:
		zones.append({"top": "Tầng mặt", "mid": "Tầng giữa", "bottom": "Tầng đáy"}.get(zone, zone))
	$Margin/Content/Zone.text = " · ".join(zones)
	var warnings := PackedStringArray()
	if water.get("temp") != null and (float(water.temp) < float(profile.tempRange[0]) or float(water.temp) > float(profile.tempRange[1])):
		warnings.append("(!) Nhiệt độ %s°C; phù hợp %s–%s°C" % [water.temp, profile.tempRange[0], profile.tempRange[1]])
	if water.get("ph") != null and (float(water.ph) < float(profile.phRange[0]) or float(water.ph) > float(profile.phRange[1])):
		warnings.append("(!) pH %s; phù hợp %s–%s" % [water.ph, profile.phRange[0], profile.phRange[1]])
	$Margin/Content/Warning.text = "\n".join(warnings)
	$Margin/Content/Warning.visible = not warnings.is_empty()
	visible = true
