extends SceneTree
## Headless style contracts, composition invariants, and scene rebuild integration.

const Styles := preload("res://scripts/tank/StyleLibrary.gd")
const Solver := preload("res://scripts/tank/LayoutSolver.gd")
const Plants := preload("res://scripts/tank/PlantLibrary.gd")
const Textures := preload("res://scripts/tank/PropTextures.gd")
var failed := false


func check(value: bool, message: String) -> void:
	if not value:
		failed = true
		push_error(message)


func _initialize() -> void:
	call_deferred("run")


func run() -> void:
	var water := Rect2(20, 44, 600, 300)
	var ground := func(_x: float) -> float: return 312.0
	check(Styles.KEYS.size() == 10, "ten styles")
	for key: String in Styles.KEYS:
		var style := Styles.load_style(key)
		check(style.key == key, "style file loaded: " + key)
		check(style.has_all(["substrate", "colors", "effects", "defaults", "water_tint", "parallax_layers", "layout_rule", "light", "floating_allowed"]), "complete schema: " + key)
		for value: Variant in style.light.values():
			check(float(value) >= 0 and float(value) <= 1, "normalized light")
		check(Solver.solve({}, style, water, ground) == Solver.solve({}, style, water, ground), "deterministic: " + key)
	check(Styles.load_style("unknown") == Styles.load_style("nature"), "unknown fallback")
	check(Styles.load_style("../dutch") == Styles.load_style("nature"), "path fallback")
	for key: String in ["paludarium", "balcony_jar", "foam_box"]:
		check(Styles.load_style(key).get("todo_shape", false), "deferred shape")
	check(Plants.all().size() == 14, "six existing + eight new plants")
	for key: String in Plants.all():
		var profile := Plants.profile(key)
		check(profile.has_all(["band", "heightPx", "sway", "colorGroup"]), "plant schema")
		check(Textures._fallback("plants", key).get_height() == profile.heightPx, "fallback height: " + key)
	check(Plants.band({"plantKey": "rotala", "position": "foreground"}) == "foreground", "DTO overrides rooted band")
	check(Plants.band({"plantKey": "frogbit", "position": "foreground"}) == "floating", "floating keeps natural band")
	check(Plants.band({"plantKey": "anubias", "position": "background"}) == "epiphyte", "epiphyte keeps natural band")
	for count in range(1, 9):
		var dto := {"tank": {"id": "real"}, "hardscape": [{"id": "r", "spriteKey": "seiryu_m", "quantity": count}, {"spriteKey": "driftwood_branch", "quantity": 2}], "plants": [{"plantKey": "carpet_grass", "quantity": 1}]}
		var layout := Solver.solve(dto, Styles.load_style("iwagumi"), water, ground)
		var rocks := layout.filter(func(p: Dictionary) -> bool: return p.refType == "hardscape")
		check(rocks.size() in [3, 5, 7], "iwagumi odd stones")
		check(rocks[0].position.x == roundf(water.position.x + water.size.x / 3), "master stone at one third")
		for rock: Dictionary in rocks:
			check(not "wood" in rock.key, "iwagumi excludes wood without DTO type")
		var carpet := layout.filter(func(p: Dictionary) -> bool: return p.key == "carpet_grass")
		check(carpet.size() >= 10 and carpet[-1].position.x - carpet[0].position.x > 500, "continuous foreground carpet")
	var dutch := Styles.load_style("dutch")
	var dto := {"plants": dutch.defaults.plants, "hardscape": [{"spriteKey": "seiryu_l"}, {"spriteKey": "driftwood_branch"}]}
	var beds := Solver.solve(dto, dutch, water, ground)
	# Dutch: one contiguous bed per species (neighbouring beds contrast), at least two open streets,
	# carpets along the front, tall stems at the back.
	var spans: Dictionary = {}
	for a in beds:
		check(a.refType == "plant", "Dutch ignores all hardscape")
		var h := int(Plants.profile(a.key).heightPx)
		var expected := "PlantsFront" if a.band == "foreground" else ("PlantsBack" if h > 64 else "PlantsMid")
		check(a.layer == expected, "Dutch height terraces")
		if a.band == "foreground":
			continue
		var span: Vector2 = spans.get(a.key, Vector2(INF, -INF))
		spans[a.key] = Vector2(minf(span.x, a.position.x), maxf(span.y, a.position.x))
	for a in beds:
		if a.band == "foreground":
			continue
		for key: String in spans:
			if key != a.key:
				check(not (a.position.x > spans[key].x and a.position.x < spans[key].y), "species beds are contiguous")
	var ordered: Array = spans.keys()
	ordered.sort_custom(func(x: String, y: String) -> bool: return spans[x].x < spans[y].x)
	var streets := 0
	for i in range(ordered.size() - 1):
		var gap: float = spans[ordered[i + 1]].x - spans[ordered[i]].y
		var half := (Vector2(Textures.SIZES[ordered[i]]).x + Vector2(Textures.SIZES[ordered[i + 1]]).x) / 2
		if gap - half >= 0:
			streets += 1
	check(ordered.size() < 3 or streets >= 2, "at least two open streets between beds")
	var low := Styles.load_style("lowtech")
	var attached := Solver.solve({}, low, water, ground)
	for plant in attached:
		if plant.get("band", "") != "epiphyte":
			continue
		check(plant.has("attached_to") and plant.position.y < 312, "epiphyte rooted on hardscape")
		var on_surface := false
		for rock in attached:
			if rock.refType == "hardscape" and absf(rock.position.x - plant.position.x) <= Vector2(Textures.SIZES[rock.key]).x / 4 + 1:
				on_surface = on_surface or is_equal_approx(plant.position.y, rock.position.y - roundf(Vector2(Textures.SIZES[rock.key]).y * 0.65))
		check(on_surface, "root meets hardscape surface")
	var bare := Solver.solve({"tank": {"id": "real"}, "plants": [{"plantKey": "bucephalandra"}]}, low, water, ground)
	check(bare.size() == 1 and bare[0].position.y == 314, "epiphyte falls back to substrate")
	var frog := {"tank": {"id": "real"}, "plants": [{"id": "f", "plantKey": "frogbit", "quantity": 2}], "scene": {"props": [{"refType": "plant", "refId": "f", "key": "frogbit", "x": 220, "y": 300, "layer": "front"}]}}
	var floats := Solver.solve(frog, low, water, ground)
	check(floats.size() == 2 and floats[0].layer == "Surface" and floats[0].position.y == 76 and floats[1].layer == "Surface", "saved/new frogbit stays at surface")
	check(Solver.serialize(floats)[0].layer == "surface", "floating layer survives save")
	check(Solver.solve(frog, Styles.load_style("iwagumi"), water, ground).is_empty(), "floating disallowed")
	# Exercise real consumers, not only the solver: load/patch must replace style FX.
	var stage: Control = load("res://scenes/pixel_stage.tscn").instantiate()
	root.add_child(stage)
	for frame in range(5):
		await process_frame
	var bridge := root.get_node("Bridge")
	var view: Node2D = stage.get_node("Frame/Viewport/Main/TankView")
	var requested := "nature"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--style="):
			requested = str(Styles.load_style(arg.trim_prefix("--style=")).key)
	check(view.style.key == requested, "desktop startup selects requested dev sample")
	for key: String in Styles.KEYS:
		var scene := {"tank": {"id": "dev-style-test", "style": key}}
		bridge._receive("scene:load", scene)
		check(view.style.key == key, "scene load style")
		check(view.get_node("WaterBack").get_children().filter(func(n: Node) -> bool: return n is Parallax2D).size() == int(view.style.parallax_layers), "parallax layer count")
		var tint: ShaderMaterial = view.get_node("Glass/WaterTint").material
		check(is_equal_approx(tint.get_shader_parameter("water_color").a, view.style.water_tint.alpha), "water overlay alpha")
		check(is_equal_approx(view.get_node("WaterBack/GodRays").material.get_shader_parameter("intensity"), view.style.light.god_rays), "ray intensity")
		check(is_equal_approx(view.get_node("Substrate/SubstrateCaustics").material.get_shader_parameter("intensity"), 0.07 * view.style.light.caustics), "caustic intensity")
	bridge._receive("scene:load", {"tank": {"id": "real", "style": "nature"}, "plants": [{"plantKey": "hygrophila"}]})
	var calm: float = view.prop_sprites[0].material.get_shader_parameter("current")
	bridge._receive("scene:patch", {"tank": {"id": "real", "style": "stream"}})
	var flowing: float = view.prop_sprites[0].material.get_shader_parameter("current")
	check(calm == 0 and absf(flowing) == 1, "stream changes sway current from zero to full bias")
	check(view.prop_sprites[0].material.shader.code.contains("wave + current"), "shader adds current to sway wave")
	check(view.get_node("Particles")._bubbles.size() > 0, "stream bubbles without equipment")
	bridge._receive("scene:patch", {"tank": {"id": "dev-style-test", "style": "dutch"}})
	check(view.style.key == "dutch" and view.layout.all(func(p: Dictionary) -> bool: return p.refType == "plant"), "patch reapplies Dutch")
	bridge._receive("scene:load", frog)
	var sprite: Sprite2D = view.prop_sprites[0]
	check(sprite.get_parent().name == "Surface" and is_equal_approx(sprite.position.y + sprite.offset.y + 2, view.water_rect.position.y), "floating sprite top at surface")
	view._process(10)
	check(absf(sprite.position.x - view.layout[0].position.x) <= 12 and not is_equal_approx(sprite.position.x, view.layout[0].position.x), "bounded slow floating drift")
	for frame in range(2):
		await process_frame
	print("StyleSystem: ", "FAIL" if failed else "PASS")
	quit(1 if failed else 0)
