extends Node2D
var age := 0.0
var water := Rect2()

func _process(delta: float) -> void:
	age += delta
	if age >= 0.4:
		queue_free()
	else:
		queue_redraw()

func _draw() -> void:
	# Integer points instead of antialiased arcs, three one-pixel rings.
	for ring in range(3):
		var radius := maxi(1, roundi(age * 65) - ring * 5)
		var points: Dictionary = {}
		for angle in range(maxi(12, radius * 8)):
			var a := float(angle) / maxi(12, radius * 8) * TAU
			points[Vector2(roundf(cos(a) * radius), roundf(sin(a) * radius))] = true
		for point: Vector2 in points:
			if water.has_point(position + point):
				draw_rect(Rect2(point, Vector2.ONE), Color("F9F5E9"))
