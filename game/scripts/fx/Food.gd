extends Node2D
var point := Vector2.ZERO
var grounded := false
var consumed := false
var age := 0.0
var phase := 0.0
var substrate: Callable
var bounds := Rect2()

func setup(at: Vector2, water: Rect2, ground: Callable, seed_value: float) -> void:
	point = at
	bounds = water.grow(-4)
	substrate = ground
	phase = seed_value
	position = point.round()
	queue_redraw()

func advance(delta: float) -> void:
	if consumed:
		return
	age += delta
	if not grounded:
		point.x = clampf(point.x + sin(age * 2 + phase) * 3 * delta, bounds.position.x, bounds.end.x)
		point.y += 7 * delta
		var floor_y := minf(bounds.end.y, float(substrate.call(point.x)) - 2)
		if point.y >= floor_y:
			point.y = floor_y
			grounded = true
			age = 0
	elif age >= 60:
		consumed = true
		queue_free()
	position = point.round()
	if grounded and age > 58:
		visible = int(age * 8) % 2 == 0

func consume() -> bool:
	if consumed:
		return false
	consumed = true
	queue_free()
	return true

func _draw() -> void:
	draw_rect(Rect2(0, 0, 2, 2), Color("C9A46A"))
	draw_rect(Rect2(0, 1, 2, 1), Color("8B6B4E"))
