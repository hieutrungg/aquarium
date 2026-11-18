extends SceneTree

const Solver := preload("res://scripts/tank/LayoutSolver.gd")
const Styles := preload("res://scripts/tank/StyleLibrary.gd")
var failed := false
var sent: Array[Dictionary] = []


func check(condition: bool, message: String) -> void:
	if not condition:
		failed = true
		push_error(message)


func _initialize() -> void:
	call_deferred("run")


func run() -> void:
	var water := Rect2(20, 44, 600, 300)
	var ground := func(x: float) -> float: return 300 + roundf(x / 40)
	var dto := {"tank": {"id": "merge"},
		"plants": [{"id": "p", "plantKey": "anubias", "quantity": 3}],
		"hardscape": [{"id": "r", "spriteKey": "seiryu_l", "quantity": 1}],
		"scene": {"props": [
			{"refType": "plant", "refId": "p", "key": "anubias", "x": 200.4, "y": 260.6, "layer": "front", "flip": true},
			{"refType": "plant", "refId": "p", "key": "anubias", "x": 350, "layer": "back"},
			{"refType": "plant", "refId": "gone", "key": "moss", "x": 100},
			{"refType": "plant", "refId": "r", "key": "moss", "x": 110}]}}
	var layout := Solver.solve(dto, Styles.load_style("nature"), water, ground)
	check(layout.size() == 4, "quantity units + new rock; orphan and wrong refType removed")
	check(layout[0].position == Vector2(200.4, 260.6) and layout[0].flip and layout[0].layer == "PlantsFront", "saved coordinates, flip and layer kept")
	check(layout[1].position == Vector2(350, ground.call(350) + 2) and layout[1].layer == "PlantsBack", "same refId paired in occurrence order")
	for prop in layout:
		check(prop.has_all(["refType", "refId", "key"]), "every prop has DTO identity")
	for prop in layout.slice(2):
		check(absf(prop.position.x - 200.4) >= 48 and absf(prop.position.x - 350) >= 48, "new units avoid authored footprints")
	check(layout == Solver.solve(dto, Styles.load_style("nature"), water, ground), "deterministic merge")
	var smaller := dto.duplicate(true)
	smaller.plants[0].quantity = 1
	check(Solver.solve(smaller, Styles.load_style("nature"), water, ground).size() == 2, "quantity decrease drops excess saved units")
	var no_id := {"plants": [{"plantKey": "moss", "quantity": 2}], "hardscape": [{"spriteKey": "seiryu_s"}]}
	var anonymous := Solver.solve(no_id, {}, water, ground)
	check(anonymous.size() == 3 and anonymous[0].refId == "" and anonymous[1].refId == "", "legacy items get empty refId")
	var serialized := Solver.serialize(layout)
	check(serialized[0] == {"refType": "plant", "refId": "p", "key": "anubias", "x": 200, "y": 261, "layer": "front", "flip": true}, "save DTO exact shape and rounded coordinates")
	check(JSON.parse_string(JSON.stringify(serialized)).size() == 4, "all props are JSON serializable")
	var bridge := root.get_node("Bridge")
	var original := {"tank": {"name": "old", "style": "nature"}, "water": {"temp": 23, "ph": 7}, "plants": [1, 2]}
	var patch := {"water": {"temp": 27}, "plants": [], "care": null}
	var merged: Dictionary = bridge.merge_patch(original, patch)
	check(merged.water == {"temp": 27} and merged.plants == [] and merged.care == null and merged.tank == original.tank, "patch replaces complete top-level values")
	merged.tank.name = "new"
	check(original.tank.name == "old" and original.water.has("ph"), "merge leaves inputs untouched")
	var stage: Control = load("res://scenes/pixel_stage.tscn").instantiate()
	root.add_child(stage)
	for frame in range(5):
		await process_frame
	var main: Node2D = stage.get_node("Frame/Viewport/Main")
	bridge.message_sent.connect(func(type: String, payload: Variant) -> void: sent.append({"type": type, "payload": payload.duplicate(true)}))
	var initial: Array[Dictionary] = main.tank_view.layout.duplicate(true)
	check(initial[0].refId == "hs-seiryu_l" and initial[0].position.x == 420, "sample saved main rock merged with new decor")
	main.set_feeding(true)
	main.begin_layout()
	check(main.editing and not main.feeding and main.get_node("HUD/Feed").disabled, "arrange disables feeding")
	var fish: Node2D = main.world.fishes[0]
	var point: Vector2 = fish.brain.point
	main.world.step(0.2)
	check(fish.brain.point != point, "fish continue swimming while arranging")
	main.world.feed(Vector2(300, 100))
	main.click_water(Vector2(300, 100))
	check(main.world.pellets.is_empty() and sent.is_empty(), "arrange blocks fish interactions")
	main._selected_prop = 0
	var old_y: float = main.tank_view.layout[0].position.y
	main.move_prop(0, Vector2(303, old_y), true)
	check(main.tank_view.layout[0].position == Vector2(304, old_y), "Shift keeps custom y with 4px horizontal snap")
	main.move_prop(0, Vector2(303, 270), true)
	check(main.tank_view.layout[0].position == Vector2(304, 270), "Shift permits epiphyte placement above substrate")
	main.move_prop(0, Vector2(311, 200), false)
	check(main.tank_view.layout[0].position == Vector2(312, main.tank_view.get_substrate_y(312)), "drag grounds feet")
	main.flip_prop()
	main.cycle_layer(-1)
	check(main.tank_view.layout[0].flip and main.tank_view.layout[0].layer == "HardscapeBack", "flip and rock back layer")
	main.cycle_layer(1)
	main.cycle_layer(1)
	check(main.tank_view.layout[0].layer == "HardscapeMid", "rock never goes to front")
	var key := InputEventKey.new()
	key.pressed = true
	key.keycode = KEY_DELETE
	main._unhandled_input(key)
	check(main._edit_hint.text == "Xoá ở trang quản lý" and main.tank_view.layout.size() == initial.size(), "Del gives management hint")
	main.cancel_layout()
	check(main.tank_view.layout == initial and not main.editing, "Cancel restores full original layout")
	main.begin_layout()
	main.auto_layout()
	check(sent.is_empty() and main.tank_view.layout != initial, "auto arrange is preview only")
	main.cancel_layout()
	check(main.tank_view.layout == initial, "Cancel also restores auto arrange")
	main.begin_layout()
	main.move_prop(0, Vector2(333, 270), true)
	var expected: Dictionary = main.scene_payload()
	main.save_layout()
	check(sent.size() == 1 and sent[0].type == "scene:save" and sent[0].payload == expected, "Save sends all props and camera")
	check(bridge.current_dto.scene == expected and not main.editing, "saved layout retained for future partial patches")
	var long_tank: Dictionary = bridge.current_dto.tank.duplicate(true)
	long_tank.dimensions.length = 120
	bridge._receive("scene:patch", {"tank": long_tank, "water": null, "warnings": [{"message": "Nhiệt độ cao"}]})
	main._camera_x = 410
	main.camera.position.x = 410
	main.set_feeding(true)
	bridge._receive("scene:patch", {"water": {"temp": 31}})
	check(main._camera_x == 410 and main.camera.position.x == 410 and main.feeding, "patch preserves pan and feeding mode")
	check(main._water == {"temp": 31} and main._warnings.text == "Cảnh báo 1" and main._warnings.tooltip_text == "Nhiệt độ cao", "patch replaces water and shows warning tooltip")
	main.set_feeding(false)
	main.followed = main.world.fishes[0]
	main.info.show_fish(main.followed, main._water)
	main.camera.zoom = Vector2(1.25, 1.25)
	bridge._receive("scene:patch", {"care": {"overdue": []}})
	check(is_instance_valid(main.followed) and main.followed == main.world.fishes[0] and main.camera.zoom == Vector2(1.25, 1.25), "follow mode survives rebuild")
	check(main.info.visible and main.info.displayed_fish == main.followed, "open info card survives patch")
	main.begin_layout()
	bridge._receive("scene:patch", {"warnings": []})
	check(not main.editing and main.world.interactions_enabled, "incoming patch exits unsaved layout mode safely")
	var custom := {"id": "lv-real", "speciesKey": "no_sprite_yet", "speciesSlug": "ca-that", "quantity": 1,
		"nameVi": "Cá thật", "sciName": "Testus realis", "tempRange": {"min": 20, "max": 22}, "phRange": {"min": 6, "max": 7},
		"render": {"swimZone": ["bottom"], "behavior": "forage", "speed": 0.5}}
	bridge._receive("scene:patch", {"livestock": [custom]})
	var real_fish: Node2D = main.world.fishes[0]
	check(real_fish.fallback != null and real_fish.brain.profile.behavior == "forage" and real_fish.brain.is_bottom(), "missing sprite follows render behavior")
	main.info.show_fish(real_fish, {"temp": 25, "ph": 8})
	check(main.info.get_node("Margin/Content/Name").text == "Cá thật" and main.info.get_node("Margin/Content/Science").text == "Testus realis", "InfoCard prioritizes real DTO names")
	var warning_text: String = main.info.get_node("Margin/Content/Warning").text
	check(warning_text.split("\n").size() == 2 and warning_text.contains("20–22") and warning_text.contains("6–7"), "DTO range dictionaries used")
	main.info.get_node("Margin/Content/Details").pressed.emit()
	check(sent.back() == {"type": "open:species", "payload": {"speciesKey": "no_sprite_yet", "speciesSlug": "ca-that"}}, "details includes speciesKey and speciesSlug")
	key.keycode = KEY_E
	main._unhandled_input(key)
	check(main.editing, "E opens layout mode")
	main._selected_prop = 0
	key.keycode = KEY_F
	var before_flip: bool = main.tank_view.layout[0].flip
	main._unhandled_input(key)
	check(main.tank_view.layout[0].flip != before_flip and not main.feeding, "F flips in layout mode instead of feeding")
	main.move_prop(0, Vector2(-999, 0), false)
	check(main.tank_view.layout[0].position.x >= main.tank_view.water_rect.position.x and fmod(main.tank_view.layout[0].position.x, 4) == 0, "snap stays inside tank boundary")
	key.keycode = KEY_E
	main._unhandled_input(key)
	check(not main.editing, "E cancels layout mode")
	await process_frame
	print("LayoutEditing: ", "FAIL" if failed else "PASS")
	quit(1 if failed else 0)
