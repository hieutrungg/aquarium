extends SceneTree
var failed := false
const Food := preload("res://scripts/fx/Food.gd")

func check(condition: bool, message: String) -> void:
	if not condition:
		failed = true
		push_error(message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var stage: Control = load("res://scenes/pixel_stage.tscn").instantiate()
	root.add_child(stage)
	for frame in range(5):
		await process_frame
	var main: Node2D = stage.get_node("Frame/Viewport/Main")
	var world: Node = main.world
	world.set_process(false)
	check(world.fishes.size() == 29, "29 fish built")
	check(main.tank_view.fish_layers()[0].modulate != Color.WHITE, "FishBack tint retained")
	world.feed(Vector2(320, 100))
	check(world.pellets.size() >= 6 and world.pellets.size() <= 10, "6–10 pellets")
	var fish: Node2D = world.fishes[0]
	var pellet: Node2D = world.pellets[0]
	fish.brain.point = pellet.point + Vector2(5, 0)
	fish.brain.velocity = Vector2.ZERO
	world.step(1.0 / 60)
	check(fish.brain.state == "eat" and pellet.consumed, "seek food -> eat atomically")
	for frame in range(22):
		world.step(1.0 / 60)
	check(fish.brain.state != "eat", "0.3s eat pause ends")
	for p in world.pellets:
		if is_instance_valid(p) and not p.consumed:
			p.consumed = true
			p.queue_free()
	world.pellets.clear()
	var cory: Node2D
	for candidate in world.fishes:
		if candidate.species_key == "panda_cory":
			cory = candidate
			break
	var bottom_food := Food.new()
	main.tank_view.get_node("Particles").add_child(bottom_food)
	bottom_food.setup(cory.brain.point - Vector2(0, 20), main.tank_view.water_rect, main.tank_view.get_substrate_y, 0)
	world.pellets.append(bottom_food)
	world.step(1.0 / 60)
	check(cory.brain.state != "seek_food", "Cory ignores suspended pellets")
	bottom_food.point = Vector2(cory.brain.point.x, main.tank_view.get_substrate_y(cory.brain.point.x) - 2)
	bottom_food.grounded = true
	world.step(1.0 / 60)
	check(bottom_food.consumed and cory.brain.state == "eat", "Cory eats grounded pellet")
	var dissolving := Food.new()
	root.add_child(dissolving)
	dissolving.setup(Vector2(250, 305), main.tank_view.water_rect, main.tank_view.get_substrate_y, 0)
	dissolving.grounded = true
	for step in range(3599):
		dissolving.advance(1.0 / 60)
	check(not dissolving.consumed, "pellet persists until 60s")
	dissolving.advance(0.1)
	check(dissolving.consumed, "pellet dissolves after 60s on floor")
	fish.brain.state = "wander"
	fish.brain.point = Vector2(300, 180)
	world.tap(Vector2(305, 180))
	check(fish.brain.state == "flee", "tap triggers flee")
	check(fish.brain.timer >= 0.6 and fish.brain.timer <= 1.2, "flee duration")
	for step in range(90):
		world.step(1.0 / 60)
	check(fish.brain.state != "flee", "flee returns to default behavior")
	fish.highlight(true)
	check(fish.swim.get_shader_parameter("highlighted"), "outline uniform")
	main.info.show_fish(cory, {"temp": 35, "ph": 9})
	var warning_text: String = main.info.get_node("Margin/Content/Warning").text
	check(warning_text.split("\n").size() == 2 and warning_text.contains("Nhiệt độ 35") and warning_text.contains("pH 9"), "temperature + pH warnings")
	main.info.show_fish(cory, {"temp": 23, "ph": 7})
	check(not main.info.get_node("Margin/Content/Warning").visible, "healthy range hides warning")
	# Use a known opaque source pixel, accounting for current facing and pivot.
	var pick_point := fish.position
	var found := false
	for y in range(int(fish.bbox.position.y), int(fish.bbox.end.y)):
		for x in range(int(fish.bbox.position.x), int(fish.bbox.end.x)):
			if fish.image_data.get_pixel(x, y).a > 0.5:
				var source_x: float = fish.sprite.texture.get_width() - 1 - x if fish.facing_left else x
				pick_point = fish.position + Vector2((source_x + fish.sprite.offset.x) * fish.sprite.scale.x, y + fish.sprite.offset.y)
				found = true
				break
		if found:
			break
	main.click_water(pick_point, true)
	check(main.info.visible and is_instance_valid(main.followed), "click opens card, double click follows")
	main.followed.position = Vector2(380, 200)
	main._process(1.0 / 60)
	check(main.camera.position == Vector2(380, 200), "camera follows within zoomed viewport")
	main.close_interactions()
	check(not main.info.visible and main.followed == null, "Esc closes and stops following")
	var key := InputEventKey.new()
	key.pressed = true
	key.keycode = KEY_F
	main._unhandled_input(key)
	check(main.feeding, "F enables feeding mode")
	key.keycode = KEY_ESCAPE
	main._unhandled_input(key)
	check(not main.feeding, "Esc cancels feeding mode")
	# Missing textures still use PlaceholderFish under the new simulation.
	var fallback: Node2D = load("res://scenes/fish/fish.tscn").instantiate()
	root.add_child(fallback)
	fallback.setup("missing_species", {}, main.tank_view.water_rect, main.tank_view.get_substrate_y, 121, 9)
	check(fallback.fallback != null and not fallback.fallback.is_processing(), "missing texture fallback")
	fallback.free()
	var dto: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/dev/sample_scene_stress.json"))
	root.get_node("Bridge")._receive("scene:load", dto)
	await process_frame
	check(world.fishes.size() == 120 and world.pellets.is_empty(), "stress reload resets actors/food")
	world.demo = true
	world.frame = 59
	world._process(1.0 / 60)
	check(not world.pellets.is_empty(), "demo auto feeds at frame 60")
	world.frame = 179
	world._process(1.0 / 60)
	check(main.tank_view.get_node("Particles").get_child_count() > world.pellets.size(), "demo taps at frame 180")
	world.frame = 239
	world._process(1.0 / 60)
	check(main.info.visible and world.fishes[0].swim.get_shader_parameter("highlighted"), "demo outline + info at frame 240")
	print("FishIntegration: feeding, floor food, dissolution, flee, outline, info, follow, fallback, reload, demo: ", "FAIL" if failed else "PASS")
	quit(1 if failed else 0)
