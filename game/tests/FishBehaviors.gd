extends SceneTree
const Brain := preload("res://scripts/fish/FishBrain.gd")
const Profiles := preload("res://scripts/fish/SpeciesProfiles.gd")
const Grid := preload("res://scripts/fish/Boids.gd")
const FishScene := preload("res://scenes/fish/fish.tscn")
const WATER := Rect2(20, 40, 600, 300)
const DT := 0.05
var failed := false

func check(ok: bool, message: String) -> void:
	if not ok:
		failed = true
		push_error(message)

func make_fish(key: String, seed_value: int = 32) -> RefCounted:
	var fish := Brain.new()
	fish.setup(key, Profiles.resolve(key), WATER, func(_x: float) -> float: return 320, seed_value, seed_value)
	return fish

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/species_profiles.json"))
	var expected := "neon_tetra betta angelfish guppy panda_cory cardinal_tetra rummynose harlequin serpae penguin_tetra rainbowfish dwarf_gourami ram discus pencilfish altum_angel endler paradise_fish platy zebra_danio stream_goby hillstream_loach stream_loach white_cloud molly fancy_goldfish swordtail otocinclus bumblebee_goby bristlenose black_skirt tiger_barb".split(" ")
	var required := "nameVi sciName tempRange phRange swimZone behavior speed turnRate schoolRadius bodyBend finFlutter glassCling perch crevice airBreather territorial finNipper nocturnal headUp tightSchool".split(" ")
	check(data.size() == 32, "exactly 32 profiles")
	for key in expected:
		check(data.has(key), "missing profile " + key)
		for field in required:
			check(data.get(key, {}).has(field), key + " missing " + field)
		var p: Dictionary = data[key]
		check(p.tempRange.size() == 2 and p.tempRange[0] < p.tempRange[1], key + " temperature range")
		check(p.phRange.size() == 2 and p.phRange[0] < p.phRange[1], key + " pH range")
		for field in required.slice(12):
			check(p[field] is bool, key + " boolean " + field)
		# Every species also runs its unmodified default behavior safely.
		var brain := make_fish(key)
		for step in range(2400):
			brain.step(DT)
			check(brain.point.is_finite() and brain.bounds.grow(0.01).has_point(brain.point), key + " stays in water")

	for key in ["otocinclus", "bristlenose", "hillstream_loach"]:
		for side in [0, 1]:
			var fish := make_fish(key)
			fish.point = Vector2(fish.bounds.position.x + 25 if side == 0 else fish.bounds.end.x - 25, 160)
			fish.state = "cling_seek"
			fish.target = Vector2(fish.bounds.position.x if side == 0 else fish.bounds.end.x, 160)
			var attached := false
			var released := false
			var held := 0.0
			var slide_start := Vector2.ZERO
			var slide_length := 0.0
			for step in range(1400):
				var previous: String = fish.state
				fish.step(DT)
				if fish.state == "cling":
					attached = true
					held += DT
					check(is_equal_approx(fish.point.x, fish.bounds.position.x if side == 0 else fish.bounds.end.x), key + " attaches to glass edge")
					check(fish.velocity == Vector2.ZERO, key + " attached velocity zero")
				if fish.state == "cling_slide" and previous == "cling":
					slide_start = fish.point
				if previous == "cling_slide" and fish.state == "cling_leave":
					slide_length = fish.point.distance_to(slide_start)
				if previous == "cling_leave" and fish.state != "cling_leave":
					released = true
					break
			check(attached and released, key + " attaches and releases")
			check(held >= 4 and held <= 12.1, key + " holds 4–12 seconds")
			check(slide_length >= 9.7 and slide_length <= 30.3, key + " slides 10–30px")

	for key in ["bumblebee_goby", "stream_goby"]:
		var fish := make_fish(key)
		var hops := 0
		for step in range(2000):
			if step == 400:
				fish.flee(fish.point + Vector2(4, 0))
			fish.step(DT)
			if fish.state != "flee":
				check(320 - fish.point.y <= 6.001, key + " never hovers above floor")
			if fish.state == "perch_hop":
				hops += 1
			if fish.state == "perch_wait":
				check(fish.velocity == Vector2.ZERO, key + " stops between hops")
		check(hops > 0, key + " hops")

	for key in ["betta", "dwarf_gourami", "paradise_fish"]:
		for seed_value in [2, 32, 123]:
			var fish := make_fish(key, seed_value)
			var reached := false
			var returned := false
			for step in range(1800):
				fish.step(DT)
				if fish.state == "surface_gulp" and fish.point.y <= fish.bounds.position.y + 7:
					reached = true
				if reached and fish.state != "surface_gulp":
					returned = true
			check(reached and returned, key + " breathes and returns within 90s")

	for key in ["ram", "betta", "paradise_fish", "bumblebee_goby"]:
		var fish := make_fish(key)
		fish.social_timer = 0
		fish.neighbors = [{"id": 999, "species": "guppy", "point": fish.home + Vector2(35, 0), "velocity": Vector2.ZERO}]
		fish.step(DT)
		check(fish.state == "chase", key + " chases an intruder")
		var chasing := 1
		var returned := false
		for step in range(120):
			fish.step(DT)
			if fish.state == "chase":
				chasing += 1
			if fish.state != "chase" and fish.state != "return_home" and fish.point.distance_to(fish.home) < 2:
				returned = true
				break
		check(chasing >= 9 and chasing <= 12 and returned, key + " 0.5s chase then home")

	var night := make_fish("bristlenose")
	for hour in [8.0, 12.0, 17.99, 18.0, 23.0, 7.99]:
		night.set_light_schedule({"on": "08:00", "off": "18:00"}, hour)
		check(is_equal_approx(night.speed_multiplier(), 0.5 if hour >= 8 and hour < 18 else 1.6), "nocturnal schedule boundaries")
	night.set_light_schedule({"on": "22:00", "off": "06:00"}, 23)
	check(night.lights_on, "schedule crosses midnight")
	night.set_light_schedule({"on": "22:00", "off": "06:00"}, 12)
	check(not night.lights_on, "day outside midnight schedule")
	night.set_light_schedule(null, 23)
	check(night.lights_on and night.speed_multiplier() == 0.5, "missing schedule means day")
	# Compare real movement at day/night speeds, with the same seed/target.
	var day := make_fish("bristlenose")
	night = make_fish("bristlenose")
	for fish in [day, night]:
		fish.point = Vector2(200, 314)
		fish.target = Vector2(500, 314)
		fish.timer = 20
		fish.cling_timer = 20
	night.set_light_schedule({"on": "08:00", "off": "18:00"}, 23)
	for step in range(60):
		day.step(DT)
		night.step(DT)
	check(is_equal_approx(day.velocity.length(), 7) and is_equal_approx(night.velocity.length(), 22.4), "nocturnal changes actual velocity")
	var loach := make_fish("stream_loach")
	loach.shelters.append(Vector2(300, 320))
	loach._choose_target()
	check(loach.target.x == 300 and loach.target.y >= 308, "crevice uses hardscape foot")
	loach.shelters.clear()
	loach._choose_target()
	check(loach.target.x < 40 or loach.target.x > 600, "crevice edge fallback")
	for key in ["serpae", "tiger_barb"]:
		var fish := make_fish(key)
		fish.social_timer = 0
		fish.neighbors = [{"id": 999, "species": "betta", "point": fish.point + Vector2(40, 0), "velocity": Vector2(10, 0)}]
		fish.step(DT)
		check(fish.state == "nip" and fish.target == fish.neighbors[0].point - Vector2(18, 0), key + " pursues tail")
		for step in range(25):
			fish.step(DT)
		check(fish.state != "nip", key + " ends nip after 1s")

	# A synthetic off-center 96px texture exercises all large species even before
	# their concurrent asset task delivers them. No test files touch assets/.
	for key in ["discus", "altum_angel", "fancy_goldfish"]:
		var fish: Node2D = FishScene.instantiate()
		root.add_child(fish)
		fish.setup(key, {}, WATER, func(_x: float) -> float: return 320, 1, 32)
		if fish.image_data == null:
			fish.image_data = Image.create(96, 96, false, Image.FORMAT_RGBA8)
			fish.image_data.fill(Color.TRANSPARENT)
			fish.image_data.fill_rect(Rect2i(20, 24, 50, 50), Color.WHITE)
			fish.sprite.texture = ImageTexture.create_from_image(fish.image_data)
			fish.pivot = Vector2(43, 46)
			fish.bbox = Rect2(20, 24, 50, 50)
			fish.swim = ShaderMaterial.new()
			fish.swim.shader = load("res://shaders/fish_swim.gdshader")
		check(fish.sprite.texture.get_width() == 96, key + " 96px canvas")
		for left in [false, true]:
			fish.facing_left = left
			fish.advance_visual(0.05)
			var center: Vector2 = fish.bbox.get_center().floor()
			var screen_x: float = 95 - center.x if left else center.x
			var at: Vector2 = fish.position + Vector2(screen_x + fish.sprite.offset.x, center.y + fish.sprite.offset.y)
			check(fish.hit_test(at), key + " pivot-aware hit both facings")
			check(not fish.hit_test(fish.position + Vector2(150, 150)), key + " outside hit rejected")
		fish.free()
	# Exercise the head-up shader path on an available texture while the
	# penguin asset is pending, including the inverse shear used by hit-test.
	var tilted: Node2D = FishScene.instantiate()
	root.add_child(tilted)
	tilted.setup("neon_tetra", {"headUp": true}, WATER, func(_x: float) -> float: return 320, 1, 7)
	check(is_equal_approx(tilted.swim.get_shader_parameter("head_up"), 0.268) and tilted.rotation == 0, "head-up shear without node rotation")
	for left in [false, true]:
		tilted.facing_left = left
		tilted.advance_visual(DT)
		var source: Vector2 = tilted.bbox.get_center().floor()
		var shear := floorf(-0.268 * (source.x - tilted.pivot.x) + 0.5)
		var screen_x: float = tilted.sprite.texture.get_width() - 1 - source.x if left else source.x
		check(tilted.hit_test(tilted.position + Vector2(screen_x + tilted.sprite.offset.x, source.y + tilted.sprite.offset.y + shear)), "head-up hit after shear/flip")
	tilted.free()
	for key in ["rummynose", "harlequin", "cardinal_tetra"]:
		var fish := make_fish(key)
		var other := make_fish(key, 33)
		fish.point = Vector2(300, 150)
		other.point = Vector2(300, 180)
		other.velocity = Vector2(20, 0)
		var grid := Grid.new()
		grid.rebuild([fish, other])
		var tight: Vector2 = grid.steering(fish)
		fish.profile = fish.profile.duplicate(true)
		fish.profile.tightSchool = false
		check(tight.x > grid.steering(fish).x and fish.profile.schoolRadius < 60, key + " tight radius and stronger alignment")
	# Check environment wiring, not only direct Brain method calls.
	var stage: Control = load("res://scenes/pixel_stage.tscn").instantiate()
	root.add_child(stage)
	for step in range(5):
		await process_frame
	var main: Node2D = stage.get_node("Frame/Viewport/Main")
	main.world.set_process(false)
	for index in range(4):
		var fish: Node2D = FishScene.instantiate()
		main.tank_view.fish_layers()[0].add_child(fish)
		fish.setup("rummynose" if index < 3 else "bristlenose", {}, main.tank_view.water_rect, main.tank_view.get_substrate_y, 130 + index, 130 + index)
	main.world.rebuild()
	var hour: int = Time.get_time_dict_from_system().hour
	root.get_node("Bridge").current_dto.tank.lightSchedule = {"on": "%02d:00" % hour, "off": "%02d:00" % ((hour + 1) % 24)}
	main.world.step(DT)
	var shared := Vector2.ZERO
	for brain in main.world.brains:
		if brain.species == "rummynose":
			if shared == Vector2.ZERO:
				shared = brain.school_heading
			check(brain.school_heading == shared, "rummynose receives synchronized heading")
		if brain.species == "bristlenose":
			check(brain.lights_on and not brain.shelters.is_empty() and not brain.surfaces.is_empty(), "world passes schedule and prop positions")
	root.get_node("Bridge").current_dto.tank.lightSchedule = {"on": "%02d:00" % ((hour + 1) % 24), "off": "%02d:00" % ((hour + 2) % 24)}
	main.world.simulation_time = 13
	main.world.step(DT)
	for brain in main.world.brains:
		if brain.species == "bristlenose":
			check(not brain.lights_on, "world updates schedule from DTO")
		if brain.species == "rummynose":
			check(brain.school_heading.x * shared.x < 0, "rummynose turns together")
	stage.free()
	print("FishBehaviors: 32 profiles; cling, perch, air, territory, nocturnal, crevice, nip, 96px pivot: ", "FAIL" if failed else "PASS")
	quit(1 if failed else 0)
