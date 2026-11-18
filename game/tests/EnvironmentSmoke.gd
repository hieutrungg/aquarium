extends SceneTree
## Run with --script res://tests/EnvironmentSmoke.gd; append -- --visual for PNGs.

const Styles := preload("res://scripts/tank/StyleLibrary.gd")
const Solver := preload("res://scripts/tank/LayoutSolver.gd")
const Textures := preload("res://scripts/tank/PropTextures.gd")
var _builds := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var stage := load("res://scenes/pixel_stage.tscn").instantiate() as Control
	root.add_child(stage)
	var view: Node2D = stage.get_node("Frame/Viewport/Main/TankView")
	view.tank_built.connect(func() -> void: _builds += 1)
	for frame in range(4):
		await process_frame
	assert(_builds == 1 and view.fish_count == 29, "sample + tank_built")
	assert(view.get_child_count() == 13, "13 ordered layers")
	for index in range(view.LAYERS.size()):
		assert(view.get_child(index).name == view.LAYERS[index], "painter order")
	assert(view.fish_layers()[0].get_child_count() + view.fish_layers()[1].get_child_count() == 29, "fish parents")
	assert(view.get_water_rect() == Rect2(70, 44, 500, 300), "existing dimension mapping")
	assert(view.get_substrate_y(70) == 304 and view.get_substrate_y(570) == 322, "40px/22px slope")
	for x in range(70, 570):
		assert(view.get_substrate_y(x) == roundf(view.get_substrate_y(x)), "pixel substrate")
		assert(absf(view.get_substrate_y(x + 1) - view.get_substrate_y(x)) <= 1, "continuous slope")
	var style := Styles.load_style("nature")
	assert(Styles.load_style("missing") == style and Styles.load_style("../bad") == style, "style fallback")
	var dto: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/dev/sample_scene_nature.json"))
	assert(view.layout == Solver.solve(dto, style, view.water_rect, view.get_substrate_y), "stable reload seed")
	var defaults := dto.duplicate(true)
	defaults.erase("plants")
	defaults.erase("hardscape")
	var generated := Solver.solve(defaults, style, view.water_rect, view.get_substrate_y)
	assert(generated == Solver.solve(defaults, style, view.water_rect, view.get_substrate_y), "stable default layout")
	var counts := {"PlantsBack": 0, "PlantsMid": 0, "PlantsFront": 0, "HardscapeBack": 0, "HardscapeMid": 0}
	for prop in generated:
		counts[prop.layer] += 1
		assert(prop.position.y == view.get_substrate_y(prop.position.x) + 2, "grounded feet")
	for count: int in counts.values():
		assert(count > 0, "default depth groups")
	var authored := dto.duplicate(true)
	authored.scene.props = [{"refType": "plant", "refId": "pl-anubias", "key": "anubias", "x": 225, "y": 280, "layer": "mid", "flip": true},
		{"refType": "hardscape", "refId": "hs-seiryu_s", "key": "seiryu_s", "x": 350, "layer": "back"}]
	var fixed := Solver.solve(authored, style, view.water_rect, view.get_substrate_y)
	var fern: Dictionary = fixed.filter(func(p: Dictionary) -> bool: return p.refId == "pl-anubias")[0]
	var stone: Dictionary = fixed.filter(func(p: Dictionary) -> bool: return p.refId == "hs-seiryu_s")[0]
	assert(fixed.size() == view.layout.size() and fern.position == Vector2(225, 280) and fern.flip, "authored world-space feet merged with new units")
	assert(stone.position == Vector2(350, view.get_substrate_y(350) + 2), "missing y grounds authored prop")
	for key: String in Textures.SIZES:
		var kind := "plants" if key in ["carpet_grass", "anubias", "java_fern", "rotala", "vallisneria", "moss"] else "hardscape"
		var image := Textures._fallback(kind, key)
		assert(image.get_size() == Textures.SIZES[key], "native fallback size")
		assert(not image.is_invisible(), "nonempty fallback")
	var particles: Node2D = view.get_node("Particles")
	assert(particles._dust.size() == 40 and particles._bubbles.size() == 18, "sample equipment effects")
	var quiet_style := style.duplicate(true)
	quiet_style.effects = {"particles": false, "bubbles": false}
	var quiet := preload("res://scripts/tank/EnvironmentLayer.gd").new()
	quiet.configure("Particles", view.water_rect, quiet_style, view.get_substrate_y, ["filter"], 0)
	assert(quiet._dust.is_empty() and quiet._bubbles.is_empty(), "style switches disable CPU effects")
	quiet.free()
	var dry := dto.duplicate(true)
	dry.tank.equipment = []
	root.get_node("Bridge")._receive("scene:load", dry)
	assert(view.get_node("Particles")._bubbles.is_empty(), "no equipment, no bubbles")
	root.get_node("Bridge")._receive("scene:load", dto)
	await process_frame
	await process_frame
	var sample_nodes := int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	print("SAMPLE_NODES=", sample_nodes, " TANK_NODES=", _node_count(view), " FISH_BACK=", view.fish_layers()[0].get_child_count())
	if "--visual" in OS.get_cmdline_user_args():
		root.size = Vector2i(800, 600)
		stage._fit()
		await process_frame
		await RenderingServer.frame_post_draw
		var capture := root.get_texture().get_image()
		assert(capture.get_size() == Vector2i(800, 600), "800x600 window")
		for point in [Vector2i(0, 0), Vector2i(799, 599), Vector2i(79, 300), Vector2i(720, 300), Vector2i(400, 119), Vector2i(400, 480)]:
			assert(capture.get_pixelv(point).to_html(false) == "eaf6f2", "mint letterbox")
		capture.save_png("res://build/t010-desktop-800x600.png")
		await _benchmark("sample", view)
		root.get_node("Bridge")._receive("scene:load", defaults)
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://build/t010-defaults-800x600.png")
	await _benchmark("defaults" if "--visual" in OS.get_cmdline_user_args() else "sample", view)
	print("PASS: layers, API, stable layouts, authored coordinates, fallback textures, equipment, reload, letterbox")
	quit()


func _benchmark(label: String, view: Node2D) -> void:
	# Measure elapsed wall time, including rendering/present, with vsync disabled by CLI.
	# TIME_PROCESS is sampled by Godot once a second and can still contain startup time.
	for frame in range(30):
		await process_frame
	var start := Time.get_ticks_usec()
	for frame in range(150):
		await process_frame
	print("BENCHMARK %s wall_ms/frame=%.3f tree_nodes=%d tank_nodes=%d renderer=%s" % [label,
		float(Time.get_ticks_usec() - start) / 150000.0, _node_count(root), _node_count(view), RenderingServer.get_current_rendering_method()])


func _node_count(node: Node) -> int:
	var count := 1
	for child in node.get_children():
		count += _node_count(child)
	return count
