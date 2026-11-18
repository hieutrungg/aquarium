extends Node2D

signal tank_built

const Fish := preload("res://scenes/fish/fish.tscn")
const Styles := preload("res://scripts/tank/StyleLibrary.gd")
const Solver := preload("res://scripts/tank/LayoutSolver.gd")
const Textures := preload("res://scripts/tank/PropTextures.gd")
const Scenery := preload("res://scripts/tank/EnvironmentLayer.gd")
const SWAY := preload("res://shaders/plant_sway.gdshader")
const CAUSTICS := preload("res://shaders/caustics.gdshader")
const RAYS := preload("res://shaders/god_rays.gdshader")
const TINT := preload("res://shaders/water_tint.gdshader")
const MAX_FISH := 120
const LAYERS := ["Wall", "WaterBack", "HardscapeBack", "PlantsBack", "FishBack",
	"HardscapeMid", "PlantsMid", "FishFront", "Substrate", "PlantsFront", "Particles", "Surface", "Glass"]

var water_rect := Rect2(Vector2(20, 44), Vector2(600, 300))
var fish_count := 0
var style: Dictionary = {}
var layout: Array[Dictionary] = []
var _layers: Dictionary = {}


func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	Bridge.scene_loaded.connect(_on_scene_loaded)


func get_water_rect() -> Rect2:
	return water_rect


func get_substrate_y(x: float) -> float:
	var settings: Dictionary = style.get("substrate", Styles.NATURE.substrate)
	var t := clampf((x - water_rect.position.x) / water_rect.size.x, 0, 1)
	var smooth_t := t * t * (3.0 - 2.0 * t)
	var height := lerpf(float(settings.back_height), float(settings.front_height), smooth_t)
	height += sin(t * PI) * float(settings.get("curve", 3))
	return roundf(water_rect.end.y - height)


func fish_layers() -> Array[Node2D]:
	var result: Array[Node2D] = []
	for key in ["FishBack", "FishFront"]:
		if _layers.has(key):
			result.append(_layers[key])
	return result


func _on_scene_loaded(dto: Dictionary) -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()
	_layers.clear()
	fish_count = 0
	# SceneState is also an engine resource class, so resolve our autoload by path.
	var size: Vector2 = get_node("/root/SceneState").scene_size()
	water_rect = Rect2(Vector2(roundf((640.0 - size.x) / 2.0), 44), size.round())
	var tank: Dictionary = dto.get("tank", {})
	style = Styles.load_style(str(tank.get("style", "nature")))
	var seed_value := str(tank.get("id", "nature")).hash()
	for layer_name: String in LAYERS:
		var layer: Node2D
		if layer_name in ["Wall", "WaterBack", "Substrate", "Particles", "Surface", "Glass"]:
			layer = Scenery.new()
			layer.configure(layer_name, water_rect, style, get_substrate_y, tank.get("equipment", []), seed_value)
		else:
			layer = Node2D.new()
		layer.name = layer_name
		add_child(layer)
		_layers[layer_name] = layer
	_layers.FishBack.modulate = Color.WHITE.lerp(Color("8FC9BA"), 0.30)
	_layers.PlantsBack.modulate = Color.WHITE.lerp(Color("8FC9BA"), 0.15)
	if style.effects.get("god_rays", true):
		var rays := _effect(_layers.WaterBack, "GodRays", _rect_polygon(water_rect), RAYS)
		rays.material.set_shader_parameter("rect_size", water_rect.size)
		rays.material.set_shader_parameter("light_color", Color(style.colors.light))
	if style.effects.get("caustics", true):
		var lower := Rect2(water_rect.position + Vector2(0, water_rect.size.y / 2), Vector2(water_rect.size.x, water_rect.size.y / 2))
		_effect(_layers.WaterBack, "WaterCaustics", _rect_polygon(lower), CAUSTICS)
		_effect(_layers.Substrate, "SubstrateCaustics", _substrate_polygon(), CAUSTICS)
	layout = Solver.solve(dto, style, water_rect, get_substrate_y)
	for prop in layout:
		_spawn_prop(prop)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	for item: Dictionary in dto.get("livestock", []):
		var quantity := clampi(int(item.get("quantity", 0)), 0, MAX_FISH - fish_count)
		for index in range(quantity):
			var fish := Fish.instantiate()
			fish.setup(str(item.get("speciesKey", "unknown")), item.get("render", {}), water_rect, get_substrate_y, fish_count, seed_value + fish_count * 7919)
			_layers["FishBack" if rng.randf() < 0.35 else "FishFront"].add_child(fish)
			fish_count += 1
		if fish_count >= MAX_FISH:
			break
	var tint := _effect(_layers.Glass, "WaterTint", _rect_polygon(water_rect), TINT)
	tint.material.set_shader_parameter("turbidity", clampf(float(style.get("turbidity", 0)), 0, 1))
	tank_built.emit()


func _spawn_prop(prop: Dictionary) -> void:
	var asset := Textures.asset(prop.kind, prop.key)
	var sprite := Sprite2D.new()
	sprite.name = str(prop.key)
	sprite.texture = asset.texture
	sprite.centered = false
	sprite.offset = -asset.pivot
	sprite.position = prop.position
	# Mirror around the metadata pivot, keeping the same foot.
	sprite.scale.x = -1 if prop.flip else 1
	if prop.kind == "plants":
		var sway := ShaderMaterial.new()
		sway.shader = SWAY
		sway.set_shader_parameter("strength", clampf(float(style.sway), 0, 2))
		sway.set_shader_parameter("current", float(style.current))
		sway.set_shader_parameter("phase", float(prop.phase))
		sprite.material = sway
	_layers[prop.layer].add_child(sprite)


func _effect(parent: Node2D, effect_name: String, points: PackedVector2Array, shader: Shader) -> Polygon2D:
	var polygon := Polygon2D.new()
	polygon.name = effect_name
	polygon.polygon = points
	var uv := PackedVector2Array()
	for point in points:
		uv.append((point - water_rect.position) / water_rect.size)
	polygon.uv = uv
	var effect := ShaderMaterial.new()
	effect.shader = shader
	if shader == CAUSTICS:
		effect.set_shader_parameter("light_color", Color(style.colors.light))
	polygon.material = effect
	parent.add_child(polygon)
	return polygon


func _rect_polygon(rect: Rect2) -> PackedVector2Array:
	return PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])


func _substrate_polygon() -> PackedVector2Array:
	var points := PackedVector2Array()
	for x in range(int(water_rect.position.x), int(water_rect.end.x)):
		points.append(Vector2(x, get_substrate_y(x) + 1))
		points.append(Vector2(x + 1, get_substrate_y(x) + 1))
	points.append(water_rect.end)
	points.append(Vector2(water_rect.position.x, water_rect.end.y))
	return points
