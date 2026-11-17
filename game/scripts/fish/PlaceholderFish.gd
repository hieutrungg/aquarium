extends Node2D

const PALETTE: Array[Color] = [
	Color("3FB8E8"), Color("D9534F"), Color("F29A4A"),
	Color("9B7FD1"), Color("F2A7C3"), Color("2B3433"), Color("F5D06B")
]
const ZONES := {"top": Vector2(0.0, 0.35), "mid": Vector2(0.25, 0.75), "bottom": Vector2(0.75, 0.95)}

var flip_h := false
var _color := Color.WHITE
var _sprite: Sprite2D
var _bounds := Rect2()
var _point := Vector2.ZERO
var _target := Vector2.ZERO
var _velocity := Vector2.ZERO
var _speed := 22.0
var _wander_time := 0.0


func setup(species_key: String, render: Dictionary, water: Rect2) -> void:
	_color = PALETTE[posmod(species_key.hash(), PALETTE.size())]
	_speed *= maxf(0.1, float(render.get("speed", 1.0)))
	var zones: Array = render.get("swimZone", ["mid"])
	# Choose one permitted band; disjoint zones must not open the gap between them.
	var zone_name: String = str(zones.pick_random()) if not zones.is_empty() else "mid"
	var band: Vector2 = ZONES.get(zone_name, ZONES["mid"])
	_bounds = Rect2(
		Vector2(water.position.x + 8, water.position.y + water.size.y * band.x + 4),
		Vector2(water.size.x - 16, water.size.y * (band.y - band.x) - 8)
	)
	_point = _random_point()
	_target = _random_point()
	position = _point.round()
	# Keys are asset basenames, never paths supplied by the embedding page.
	if species_key.is_valid_filename() and not species_key.contains("."):
		var asset_path := "res://assets/fish/%s.png" % species_key
		if ResourceLoader.exists(asset_path):
			_sprite = Sprite2D.new()
			_sprite.texture = load(asset_path) as Texture2D
			add_child(_sprite)


func _random_point() -> Vector2:
	return _bounds.position + Vector2(randf() * _bounds.size.x, randf() * _bounds.size.y)


func _process(delta: float) -> void:
	_wander_time -= delta
	if _wander_time <= 0.0 or _point.distance_to(_target) < 8.0:
		_target = _random_point()
		_wander_time = randf_range(1.5, 4.5)
	var desired := _point.direction_to(_target) * _speed
	_velocity = _velocity.move_toward(desired, _speed * delta)
	_point += _velocity * delta
	_point = _point.clamp(_bounds.position, _bounds.end)
	if absf(_velocity.x) > 0.5:
		flip_h = _velocity.x < 0.0
	if _sprite != null:
		_sprite.flip_h = flip_h
	# Keep floating-point motion separate from the pixel-aligned drawing position.
	position = _point.round()
	queue_redraw()


func _draw() -> void:
	if _sprite != null:
		return
	var direction := -1.0 if flip_h else 1.0
	draw_colored_polygon(PackedVector2Array([
		Vector2(-6, 0), Vector2(0, -3), Vector2(6, 0), Vector2(0, 3)
	]), _color)
	draw_rect(Rect2(Vector2(3 * direction, -1), Vector2.ONE), Color("35574F"))
