extends Node2D
## Batched CPU drawing for static scenery and small animated effects.

var role := ""
var water := Rect2()
var style: Dictionary = {}
var ground := Callable()
var aerated := false
var _time := 0.0
var _dust: Array[Vector3] = []
var _bubbles: Array[Vector3] = []
var _tile: Texture2D


func configure(layer_role: String, rect: Rect2, data: Dictionary, substrate: Callable, equipment: Array, seed_value: int) -> void:
	role = layer_role
	water = rect
	style = data
	ground = substrate
	aerated = "filter" in equipment or "co2" in equipment or float(style.current) > 0
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	if role == "Particles":
		if style.effects.get("particles", true):
			for index in range(40):
				_dust.append(Vector3(rng.randf(), rng.randf(), rng.randf_range(0.3, 1)))
		if aerated and style.effects.get("bubbles", true):
			for index in range(18):
				_bubbles.append(Vector3(rng.randf(), rng.randf_range(0, TAU), rng.randi_range(1, 3)))
	_substrate_tex = null
	if role == "Substrate":
		_tile = preload("res://scripts/tank/PropTextures.gd").tile(str(style.substrate.tile), Color(style.substrate.fill), Color(style.substrate.grain))
	set_process(role in ["Particles", "Surface"])
	queue_redraw()


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _draw() -> void:
	if style.is_empty():
		return
	match role:
		"Wall": _wall()
		"WaterBack": draw_rect(water, Color(style.colors.water))
		"Distant": _distant()
		"Substrate": _substrate()
		"Particles": _particles()
		"Surface": _surface()
		"Glass": _glass()


func _wall() -> void:
	draw_rect(Rect2(-1200, 0, 3040, 360), Color(style.colors.wall))
	var shelf := Rect2(water.position.x - 12, water.end.y + 2, water.size.x + 24, 7)
	draw_rect(shelf, Color(style.colors.wood))
	draw_rect(Rect2(shelf.position + Vector2(0, 6), Vector2(shelf.size.x, 3)), Color(style.colors.wood_shadow))
	draw_line(shelf.position + Vector2(1, 1), Vector2(shelf.end.x - 1, shelf.position.y + 1), Color("B08E6E"))
	for x in [water.position.x + 28, water.end.x - 34]:
		draw_rect(Rect2(x, shelf.end.y, 6, 12), Color("6B5241"))
	var lamp_width := minf(210, water.size.x * 0.45)
	var lamp_x := roundf(water.get_center().x - lamp_width / 2)
	for x in [lamp_x + 12, lamp_x + lamp_width - 12]:
		draw_rect(Rect2(x, 0, 1, 37), Color("4F5B55"))
	draw_rect(Rect2(lamp_x, 36, lamp_width, 5), Color("6B5241"))
	draw_rect(Rect2(lamp_x + 2, 36, lamp_width - 4, 1), Color("B08E6E"))
	draw_rect(Rect2(lamp_x + 4, 41, lamp_width - 8, 2), Color("F4ECD6"))


var _substrate_tex: Texture2D
var _substrate_top := 0


func _substrate() -> void:
	# Bake once: the curve-clipped tile fill becomes one texture (one draw call instead of ~1000).
	if _substrate_tex == null:
		_substrate_tex = _bake_substrate()
	if _substrate_tex != null:
		draw_texture(_substrate_tex, Vector2(water.position.x, _substrate_top))
	if style.get("leaf_litter", false):
		for i in range(22):
			var x := water.position.x + 12 + fposmod(i * 47.0, water.size.x - 24)
			var y := float(ground.call(x)) + 3 + i % 9
			draw_colored_polygon(PackedVector2Array([Vector2(x - 5, y), Vector2(x, y - 2), Vector2(x + 6, y + 1), Vector2(x, y + 3)]), Color("9C8463"))
			draw_line(Vector2(x - 3, y), Vector2(x + 4, y + 1), Color("6B5241"))


func _bake_substrate() -> Texture2D:
	var width := int(water.size.x)
	var bottom := int(water.end.y)
	var tops := PackedInt32Array()
	tops.resize(width)
	_substrate_top = bottom
	for column in range(width):
		tops[column] = int(ground.call(water.position.x + column))
		_substrate_top = mini(_substrate_top, tops[column])
	var height := bottom - _substrate_top
	if width <= 0 or height <= 0:
		return null
	var tile := _tile.get_image()
	tile.decompress()
	var tw := tile.get_width()
	var th := tile.get_height()
	var rim := Color(style.substrate.rim)
	var image := Image.create_empty(width, height, false, Image.FORMAT_RGBA8)
	for column in range(width):
		for y in range(tops[column], bottom):
			var color := rim if y == tops[column] else tile.get_pixel(posmod(column, tw), posmod(y, th))
			image.set_pixel(column, y - _substrate_top, color)
	return ImageTexture.create_from_image(image)


func _particles() -> void:
	var light := Color(style.colors.light)
	for mote in _dust:
		var x := water.position.x + fposmod(mote.x * water.size.x + _time * (1.5 + float(style.current) * 5), water.size.x - 2) + 1
		var top := water.position.y + 6
		var bottom := float(ground.call(x)) - 3
		var y := top + fposmod(mote.y * (bottom - top) - _time * mote.z * 1.2, bottom - top)
		draw_rect(Rect2(Vector2(x, y).floor(), Vector2.ONE), light)
	if not _bubbles.is_empty():
		var emitter_x := water.position.x + 18
		var bottom := float(ground.call(emitter_x)) - 2
		var rise := bottom - water.position.y - 5
		draw_rect(Rect2(emitter_x - 3, bottom, 8, 3), Color("6E7D74"))
		draw_line(Vector2(emitter_x, bottom), Vector2(emitter_x, water.position.y + 2), Color("8FC9BA"))
		for bubble in _bubbles:
			var age := fposmod(bubble.x * rise + _time * (12 + bubble.z * 3), rise)
			var x := roundf(water.position.x + fposmod(emitter_x - water.position.x + sin(age * 0.13 + bubble.y) * 3 + age * float(style.current) * 1.7, water.size.x))
			var y := roundf(bottom - age)
			if bubble.z <= 1:
				draw_rect(Rect2(x, y, 1, 1), light)
			else:
				draw_rect(Rect2(x, y, bubble.z, bubble.z), light, false, 1)


func _surface() -> void:
	var light := Color(style.colors.light)
	draw_rect(Rect2(water.position, Vector2(water.size.x, 1)), Color("8FC9BA"))
	for index in range(0, int(water.size.x) - 2, 3):
		var y := water.position.y + 1 + roundf(sin(index * 0.065 + _time * 1.4))
		draw_rect(Rect2(water.position.x + index, y, mini(3, int(water.size.x) - index), 1), light)


func _distant() -> void:
	var depth := int(get_meta("depth", 0))
	var color := Color(style.colors.wall).lerp(Color(style.colors.water), 0.65)
	color.a = 0.12 + depth * 0.03
	# Muted broad silhouettes suggest distant foliage without adding sharp detail.
	for i in range(16):
		var x := water.position.x + i * water.size.x / 15.0
		var bottom := water.end.y - 28
		var h := 55.0 + fposmod(i * 31.0 + depth * 23, 110)
		draw_colored_polygon(PackedVector2Array([Vector2(x - 14, bottom), Vector2(x - 9, bottom - h * 0.7), Vector2(x + depth * 5, bottom - h), Vector2(x + 13, bottom - h * 0.5), Vector2(x + 17, bottom)]), color)


func _glass() -> void:
	draw_rect(water.grow(1), Color(style.colors.ink), false, 1)
	draw_line(Vector2(water.position.x - 1, water.end.y + 1), water.end + Vector2(1, 1), Color("5E9E8E"), 2)
	for offset in [30, 46]:
		var a := water.position + Vector2(offset, 15)
		var b := a + Vector2(25, 88)
		draw_line(a, b, Color(0.839216, 0.941176, 0.909804, 0.18), 2)
