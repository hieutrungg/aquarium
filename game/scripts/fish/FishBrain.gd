extends RefCounted
## Float simulation, independent of Node2D; FishWorld provides the shared snapshot.
var id := 0
var species := ""
var profile: Dictionary
var point := Vector2.ZERO
var velocity := Vector2.ZERO
var state := "wander"
var bounds := Rect2()
var substrate: Callable
var target := Vector2.ZERO
var timer := 0.0
var gulp_timer := 60.0
var gulp_return := false
var food: Variant = null
var school_force := Vector2.ZERO
var social_force := Vector2.ZERO
var rng := RandomNumberGenerator.new()
var _flee_from := Vector2.ZERO
var _rest_next := false
var floor_clearance := 4.0
var air_flee_timer := 0.0

func setup(key: String, settings: Dictionary, water: Rect2, ground: Callable, index: int, seed_value: int) -> void:
	species = key
	profile = settings
	id = index
	bounds = water.grow(-4)
	substrate = ground
	rng.seed = seed_value
	state = str(profile.behavior)
	point = Vector2(rng.randf_range(bounds.position.x, bounds.end.x), rng.randf_range(_band().x, _band().y))
	if is_bottom():
		point.y = _ground(point.x) - floor_clearance - 2
	constrain()
	target = point
	gulp_timer = rng.randf_range(40, 90)

func is_bottom() -> bool:
	return species == "panda_cory" or str(profile.behavior) == "forage"

func _ground(x: float) -> float:
	return minf(bounds.end.y, float(substrate.call(x))) if substrate.is_valid() else bounds.end.y

func _band() -> Vector2:
	var low := 1.0
	var high := 0.0
	for zone: String in profile.get("swimZone", ["mid"]):
		var band: Vector2 = {"top": Vector2(0.02, 0.38), "mid": Vector2(0.25, 0.76), "bottom": Vector2(0.8, 0.96)}.get(zone, Vector2(0.25, 0.76))
		low = minf(low, band.x)
		high = maxf(high, band.y)
	return Vector2(bounds.position.y + bounds.size.y * low, bounds.position.y + bounds.size.y * high)

func flee(origin: Vector2, duration: float = -1) -> void:
	_flee_from = origin
	var flee_duration := duration if duration > 0 else rng.randf_range(0.6, 1.2)
	if state == "surface_gulp":
		# React in the air-trip state; switching to a bottom state would snap to sand.
		air_flee_timer = flee_duration
		return
	food = null
	state = "flee"
	timer = flee_duration

func seek_food(pellet: Variant) -> void:
	if state in ["flee", "eat", "surface_gulp"]:
		return
	food = pellet
	state = "seek_food"

func _resume() -> void:
	food = null
	state = str(profile.behavior)
	timer = 0

func _choose_target() -> void:
	var band := _band()
	if is_bottom():
		target = Vector2(clampf(point.x + rng.randf_range(-42, 42), bounds.position.x, bounds.end.x), point.y)
		target.y = _ground(target.x) - floor_clearance - 2
		timer = rng.randf_range(0.7, 1.8)
	else:
		target = Vector2(clampf(point.x + rng.randf_range(-110, 110), bounds.position.x, bounds.end.x), rng.randf_range(band.x, band.y))
		timer = rng.randf_range(2, 5)

func step(delta: float) -> void:
	delta = minf(delta, 0.05)
	timer -= delta
	gulp_timer -= delta
	if is_bottom() and gulp_timer <= 0 and state not in ["surface_gulp", "flee", "eat"]:
		state = "surface_gulp"
		gulp_return = false
		gulp_timer = rng.randf_range(40, 90)
		target = Vector2(point.x, bounds.position.y + 3)
	var speed := float(profile.speed)
	var desired := Vector2.ZERO
	match state:
		"eat", "rest":
			if timer <= 0:
				_resume()
		"flee":
			desired = _flee_from.direction_to(point) * speed * 2.5
			if is_bottom():
				desired = Vector2(signf(point.x - _flee_from.x), 0) * speed * 2.5
			if desired == Vector2.ZERO:
				desired = Vector2.RIGHT * speed * 2.5
			if timer <= 0:
				_resume()
		"surface_gulp":
			# Keep this state throughout descent so the bottom invariant stays explicit.
			if not gulp_return and point.y <= bounds.position.y + 7:
				gulp_return = true
				target.y = _ground(point.x) - floor_clearance - 2
			if gulp_return and point.distance_to(target) < 5:
				_resume()
			desired = point.direction_to(target) * (100.0 if not gulp_return else 48.0)
			if air_flee_timer > 0:
				air_flee_timer -= delta
				desired += _flee_from.direction_to(point) * speed * 2.5
		"seek_food":
			if not is_instance_valid(food) or food.consumed or (is_bottom() and not food.grounded):
				_resume()
			else:
				target = food.point
				desired = _arrive(target, speed * 1.5, 14)
				var bite_radius := 14.0 if is_bottom() else 7.0
				if point.distance_to(target) < bite_radius and food.consume():
					state = "eat"
					timer = 0.3
					food = null
					desired = Vector2.ZERO
		_:
			if timer <= 0 or point.distance_to(target) < 5:
				if _rest_next:
					state = "rest"
					timer = rng.randf_range(2.5, 6) if profile.behavior == "hover" else rng.randf_range(0.7, 2.2)
					_rest_next = false
				else:
					_choose_target()
					_rest_next = is_bottom() or profile.behavior == "hover" or (species == "betta" and rng.randf() < 0.65)
			if state != "rest":
				desired = _arrive(target, speed, 25)
				if profile.behavior == "school":
					desired = (desired * 0.55 + school_force).limit_length(speed)
				elif species == "guppy":
					desired = (desired + school_force * 0.15).limit_length(speed)
				desired += social_force
	# Soft zone correction is bypassed for food, fleeing and the Cory air trip.
	if state not in ["surface_gulp", "seek_food", "flee", "eat"] and not is_bottom():
		var band := _band()
		desired.y += clampf(band.x - point.y, 0, 25) - clampf(point.y - band.y, 0, 25)
	var acceleration := maxf(12, speed * float(profile.turnRate))
	if state == "surface_gulp":
		acceleration = 160
	velocity = velocity.move_toward(desired, acceleration * delta)
	point += velocity * delta
	constrain()

func _arrive(destination: Vector2, speed: float, radius: float) -> Vector2:
	return point.direction_to(destination) * speed * minf(1, point.distance_to(destination) / radius)

func constrain() -> void:
	var before := point
	point = point.clamp(bounds.position, bounds.end)
	var floor_y := _ground(point.x) - floor_clearance
	point.y = minf(point.y, floor_y)
	if is_bottom() and state != "surface_gulp":
		point.y = clampf(point.y, _ground(point.x) - maxf(12, floor_clearance), floor_y)
	if point.x != before.x:
		velocity.x = 0
	if point.y != before.y:
		velocity.y = 0
