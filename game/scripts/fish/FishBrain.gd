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
var home := Vector2.ZERO
var air_origin := Vector2.ZERO
var surfaces: Array[Vector2] = []
var shelters: Array[Vector2] = []
var neighbors: Array = []
var lights_on := true
var cling_timer := 6.0
var social_timer := 4.0
var slide_origin := Vector2.ZERO
var school_heading := Vector2.ZERO
var pursuit_id := -1

func flag(key: String) -> bool:
	return bool(profile.get(key, false))

func speed_multiplier() -> float:
	return (0.5 if lights_on else 1.6) if flag("nocturnal") else 1.0

# Local wall-clock schedule, matching the DTO's HH:MM on/off contract.
# Missing or invalid schedules intentionally mean daytime.
func set_light_schedule(schedule: Variant, hour: float) -> void:
	lights_on = true
	if not schedule is Dictionary:
		return
	var start := _clock_hour(str(schedule.get("on", "")))
	var end := _clock_hour(str(schedule.get("off", "")))
	if start < 0 or end < 0:
		return
	lights_on = (hour >= start and hour < end) if start < end else (hour >= start or hour < end)
	if start == end:
		lights_on = true

func _clock_hour(value: String) -> float:
	var parts := value.split(":")
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return -1
	var h := int(parts[0])
	var m := int(parts[1])
	return h + m / 60.0 if h >= 0 and h < 24 and m >= 0 and m < 60 else -1.0

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
	home = point
	gulp_timer = rng.randf_range(30, 70) if flag("airBreather") else rng.randf_range(40, 90)
	cling_timer = rng.randf_range(4, 12)

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
	if state in ["flee", "eat", "surface_gulp", "cling", "cling_seek", "cling_slide", "cling_leave", "chase", "return_home", "nip"]:
		return
	food = pellet
	state = "seek_food"

func _resume() -> void:
	food = null
	state = str(profile.behavior)
	timer = 0

func _choose_target() -> void:
	var band := _band()
	if flag("crevice") or (flag("nocturnal") and lights_on):
		target = _shelter()
		timer = rng.randf_range(4, 9)
	elif flag("territorial"):
		target = home + Vector2.from_angle(rng.randf() * TAU) * rng.randf_range(10, 45)
		target = target.clamp(bounds.position, bounds.end)
		timer = rng.randf_range(2, 4)
	elif is_bottom():
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
	cling_timer -= delta
	social_timer -= delta
	if (species == "panda_cory" or flag("airBreather")) and gulp_timer <= 0 and state not in ["surface_gulp", "flee", "eat"]:
		air_origin = point
		state = "surface_gulp"
		gulp_return = false
		gulp_timer = rng.randf_range(30, 70) if flag("airBreather") else rng.randf_range(40, 90)
		target = Vector2(point.x, bounds.position.y + 3)
	if state in [str(profile.behavior), "rest", "perch_wait"]:
		_special_idle()
	if state in ["chase", "nip"]:
		for entry: Dictionary in neighbors:
			if int(entry.id) == pursuit_id:
				target = entry.point
				if state == "nip":
					var heading: Vector2 = entry.velocity.normalized() if entry.velocity.length() > 1 else Vector2.RIGHT
					target -= heading * 18
	var speed := float(profile.speed) * speed_multiplier()
	var desired := Vector2.ZERO
	match state:
		"cling_seek":
			desired = _arrive(target, speed, 12)
			if point.distance_to(target) < 1:
				point = target
				velocity = Vector2.ZERO
				desired = Vector2.ZERO
				state = "cling"
				timer = rng.randf_range(4, 12)
		"cling":
			velocity = Vector2.ZERO
			if timer <= 0:
				slide_origin = point
				var distance := rng.randf_range(10, 30)
				var side := is_equal_approx(point.x, bounds.position.x) or is_equal_approx(point.x, bounds.end.x)
				var direction := Vector2(0, 1 if point.y < bounds.get_center().y else -1) if side else Vector2(1 if point.x < bounds.get_center().x else -1, 0)
				target = (point + direction * distance).clamp(bounds.position, bounds.end)
				state = "cling_slide"
		"cling_slide":
			desired = point.direction_to(target) * minf(4, point.distance_to(target) / delta)
			if point.distance_to(target) < 0.3:
				state = "cling_leave"
				cling_timer = rng.randf_range(12, 25)
				target.x = clampf(point.x + (35 if point.x < bounds.get_center().x else -35), bounds.position.x, bounds.end.x)
				target.y = _ground(target.x) - floor_clearance - 2
		"cling_leave":
			desired = _arrive(target, speed, 10)
			if point.distance_to(target) < 2:
				_resume()
		"perch_wait":
			velocity = Vector2.ZERO
			if timer <= 0:
				state = "perch_hop"
				timer = 0.2
				target.x = clampf(point.x + rng.randf_range(-25, 25), bounds.position.x, bounds.end.x)
		"perch_hop":
			desired.x = signf(target.x - point.x) * speed * 3
			if timer <= 0:
				state = "perch_wait"
				timer = rng.randf_range(1.5, 4)
				velocity = Vector2.ZERO
				desired = Vector2.ZERO
		"chase", "nip":
			desired = _arrive(target, speed * 2, 6)
			if timer <= 0:
				state = "return_home" if flag("territorial") else str(profile.behavior)
				social_timer = rng.randf_range(6, 12)
		"return_home":
			desired = _arrive(home, speed * 1.5, 10)
			if point.distance_to(home) < 2:
				point = home
				velocity = Vector2.ZERO
				_resume()
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
				target = air_origin if flag("airBreather") else Vector2(point.x, _ground(point.x) - floor_clearance - 2)
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
				if species == "rummynose" and school_heading != Vector2.ZERO:
					desired = (school_heading * speed + school_force * 0.15).limit_length(speed)
				elif profile.behavior == "school":
					desired = (desired * 0.55 + school_force).limit_length(speed)
				elif species == "guppy":
					desired = (desired + school_force * 0.15).limit_length(speed)
				desired += social_force
	# Soft zone correction is bypassed for food, fleeing and the Cory air trip.
	if state in ["wander", "school", "hover", "rest"] and not is_bottom():
		var band := _band()
		desired.y += clampf(band.x - point.y, 0, 25) - clampf(point.y - band.y, 0, 25)
	var acceleration := maxf(12, speed * float(profile.turnRate))
	if state == "surface_gulp":
		acceleration = 160
	if state == "perch_hop":
		acceleration = speed * 100
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
	if is_bottom() and state not in ["surface_gulp", "cling_seek", "cling", "cling_slide", "cling_leave"]:
		var gap := 6.0 if flag("perch") else maxf(12, floor_clearance)
		point.y = clampf(point.y, _ground(point.x) - maxf(gap, floor_clearance), floor_y)
	if point.x != before.x:
		velocity.x = 0
	if point.y != before.y:
		velocity.y = 0

func _shelter() -> Vector2:
	var result := Vector2(bounds.position.x + 8 if home.x < bounds.get_center().x else bounds.end.x - 8, 0)
	var best := INF
	for candidate: Vector2 in shelters:
		if point.distance_squared_to(candidate) < best:
			result = candidate
			best = point.distance_squared_to(candidate)
	result.x = clampf(result.x, bounds.position.x, bounds.end.x)
	result.y = _ground(result.x) - floor_clearance - 2
	return result

func _special_idle() -> void:
	if flag("glassCling") and cling_timer <= 0:
		var side := rng.randi_range(0, 2)
		target = Vector2(bounds.position.x if side == 0 else bounds.end.x, rng.randf_range(bounds.position.y + 10, _ground(point.x) - floor_clearance))
		if side == 2:
			# Back glass covers the water rectangle in this side view.
			target = Vector2(rng.randf_range(bounds.position.x, bounds.end.x), rng.randf_range(_band().x, _band().y))
		if not surfaces.is_empty() and rng.randf() < 0.5:
			target = surfaces[rng.randi_range(0, surfaces.size() - 1)]
		target = target.clamp(bounds.position, bounds.end)
		target.y = minf(target.y, _ground(target.x) - floor_clearance)
		state = "cling_seek"
	elif social_timer <= 0:
		for entry: Dictionary in neighbors:
			if flag("territorial") and entry.species != species and home.distance_to(entry.point) < 50:
				state = "chase"
				pursuit_id = int(entry.id)
				target = entry.point
				timer = 0.5
				return
			if flag("finNipper") and entry.species in ["betta", "angelfish", "guppy", "altum_angel", "dwarf_gourami"]:
				state = "nip"
				pursuit_id = int(entry.id)
				var heading: Vector2 = entry.velocity.normalized() if entry.velocity.length() > 1 else Vector2.RIGHT
				target = entry.point - heading * 18
				timer = 1
				return
	if flag("perch") and state in [str(profile.behavior), "rest"]:
		state = "perch_wait"
		timer = rng.randf_range(1.5, 4)
