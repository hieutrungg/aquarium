extends PanelContainer
var species_key := ""

func _ready() -> void:
	$Margin/Content/Details.pressed.connect(func() -> void:
		get_node("/root/Bridge").send("open:species", {"speciesKey": species_key}))

func show_fish(fish: Node2D, water: Dictionary) -> void:
	species_key = fish.species_key
	var profile: Dictionary = fish.profile
	$Margin/Content/Name.text = str(profile.nameVi)
	$Margin/Content/Science.text = str(profile.sciName)
	var zones := PackedStringArray()
	for zone: String in profile.swimZone:
		zones.append({"top": "Tầng mặt", "mid": "Tầng giữa", "bottom": "Tầng đáy"}.get(zone, zone))
	$Margin/Content/Zone.text = " · ".join(zones)
	var warnings := PackedStringArray()
	if water.has("temp") and (float(water.temp) < float(profile.tempRange[0]) or float(water.temp) > float(profile.tempRange[1])):
		warnings.append("⚠ Nhiệt độ %s°C; phù hợp %s–%s°C" % [water.temp, profile.tempRange[0], profile.tempRange[1]])
	if water.has("ph") and (float(water.ph) < float(profile.phRange[0]) or float(water.ph) > float(profile.phRange[1])):
		warnings.append("⚠ pH %s; phù hợp %s–%s" % [water.ph, profile.phRange[0], profile.phRange[1]])
	$Margin/Content/Warning.text = "\n".join(warnings)
	$Margin/Content/Warning.visible = not warnings.is_empty()
	visible = true
