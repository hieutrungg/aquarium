extends Node2D
const Brain := preload("res://scripts/fish/FishBrain.gd")
const Profiles := preload("res://scripts/fish/SpeciesProfiles.gd")
const SWIM := preload("res://shaders/fish_swim.gdshader")
const Placeholder := preload("res://scripts/fish/PlaceholderFish.gd")
static var images: Dictionary = {}
var brain := Brain.new()
var species_key := ""
var dto: Dictionary = {}
var profile: Dictionary
var sprite: Sprite2D
var swim: ShaderMaterial
var fallback: Node2D
var pivot := Vector2(32, 32)
var bbox := Rect2(0, 0, 64, 64)
var image_data: Image
var facing_left := false
var _pending_left := false
var _turn_time := -1.0
var _last_velocity := Vector2.ZERO
var _phase := 0.0
var _highlighted := false

func setup(key: String, render: Dictionary, water: Rect2, ground: Callable, index: int, seed_value: int) -> void:
	species_key = key
	profile = Profiles.resolve(key, render)
	brain.setup(key, profile, water, ground, index, seed_value)
	position = brain.point.round()
	sprite = get_node("Sprite2D")
	var path := "res://assets/fish/%s.png" % key
	if key.is_valid_filename() and not key.contains(".") and ResourceLoader.exists(path):
		sprite.texture = load(path) as Texture2D
		var size := sprite.texture.get_size()
		pivot = size / 2
		bbox = Rect2(Vector2.ZERO, size)
		var metadata_path := path.get_basename() + ".json"
		if FileAccess.file_exists(metadata_path):
			var metadata: Variant = JSON.parse_string(FileAccess.get_file_as_string(metadata_path))
			if metadata is Dictionary:
				var p: Dictionary = metadata.get("pivot", {})
				pivot = Vector2(float(p.get("x", pivot.x)), float(p.get("y", pivot.y)))
				var box: Dictionary = metadata.get("bbox", {})
				bbox = Rect2(float(box.get("x", 0)), float(box.get("y", 0)), float(box.get("width", size.x)), float(box.get("height", size.y)))
		sprite.offset = -pivot.round()
		# Keep the full silhouette, including its bend, inside water and above sand.
		var bend_margin := ceilf(float(profile.bodyBend) + float(profile.finFlutter))
		var half_x := ceilf(maxf(pivot.x - bbox.position.x, bbox.end.x - pivot.x)) + 1
		var half_y := ceilf(maxf(pivot.y - bbox.position.y, bbox.end.y - pivot.y)) + bend_margin
		brain.bounds = water.grow(-4).grow_individual(-half_x, -half_y, -half_x, -half_y)
		brain.floor_clearance = minf(12, ceilf(bbox.end.y - pivot.y) + bend_margin) if brain.is_bottom() else ceilf(bbox.end.y - pivot.y) + bend_margin
		brain.constrain()
		position = brain.point.round()
		swim = ShaderMaterial.new()
		swim.shader = SWIM
		_phase = brain.rng.randf() * TAU
		swim.set_shader_parameter("phase", _phase)
		swim.set_shader_parameter("body_x", Vector2(bbox.position.x / size.x, bbox.end.x / size.x))
		swim.set_shader_parameter("body_bend", float(profile.bodyBend))
		swim.set_shader_parameter("fin_flutter", float(profile.finFlutter))
		sprite.material = swim
		if not images.has(path):
			images[path] = sprite.texture.get_image()
		image_data = images[path]
	else:
		# Retain the old procedural fish, but all motion belongs to the new brain.
		fallback = Placeholder.new()
		fallback.setup(key, render, water)
		fallback.set_process(false)
		fallback.position = Vector2.ZERO
		add_child(fallback)
		fallback.set_process(false)

func advance_visual(delta: float) -> void:
	position = brain.point.round()
	if absf(brain.velocity.x) > 1.5 and _turn_time < 0:
		_pending_left = brain.velocity.x < 0
		if _pending_left != facing_left:
			_turn_time = 0
	var squash := 1.0
	if _turn_time >= 0:
		_turn_time += delta
		# Discrete frames: no interpolation/rotation of the pixel sprite.
		if _turn_time < 0.04:
			squash = 0.8
		elif _turn_time < 0.10:
			squash = 0.6
			if _turn_time >= 0.075:
				facing_left = _pending_left
		elif _turn_time < 0.15:
			squash = 0.8
		else:
			_turn_time = -1
	if swim != null:
		sprite.scale.x = squash
		sprite.offset.x = -roundf(sprite.texture.get_width() - pivot.x if facing_left else pivot.x)
		swim.set_shader_parameter("flip", facing_left)
		var turning := (brain.velocity - _last_velocity).length() / maxf(delta * float(profile.speed), 0.01)
		swim.set_shader_parameter("activity", minf(3, brain.velocity.length() / float(profile.speed) + turning * 0.15))
	elif fallback != null:
		fallback.flip_h = facing_left
		fallback.scale.x = squash
		fallback.modulate = Color("F9F5E9") if _highlighted else Color.WHITE
		fallback.queue_redraw()
	_last_velocity = brain.velocity

func highlight(enabled: bool) -> void:
	if _highlighted == enabled:
		return
	_highlighted = enabled
	if swim != null:
		swim.set_shader_parameter("highlighted", enabled)

func hit_test(world_point: Vector2) -> bool:
	var local := to_local(world_point)
	if image_data == null:
		return Rect2(-7, -4, 14, 8).has_point(local)
	local.x /= sprite.scale.x
	var pixel := local - sprite.offset
	if facing_left:
		pixel.x = sprite.texture.get_width() - 1 - pixel.x
	# A small bbox margin covers the shader's integer displacement.
	if not bbox.grow(float(profile.bodyBend) + float(profile.finFlutter)).has_point(pixel):
		return false
	for dy in range(-2, 3):
		var sample_point := Vector2i(floori(pixel.x), floori(pixel.y) + dy)
		if sample_point.x >= 0 and sample_point.y >= 0 and sample_point.x < image_data.get_width() and sample_point.y < image_data.get_height() and image_data.get_pixelv(sample_point).a > 0.5:
			return true
	return false
