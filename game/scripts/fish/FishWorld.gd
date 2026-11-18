extends Node
signal demo_fish_selected(fish: Node2D)
const Hash := preload("res://scripts/fish/Boids.gd")
const FOOD := preload("res://scenes/fx/food.tscn")
const Ripple := preload("res://scripts/fx/GlassRipple.gd")
var tank: Node2D
var fishes: Array = []
var brains: Array = []
var pellets: Array = []
var boids := Hash.new()
var frame := 0
var last_step_usec := 0
var demo := false
var rng := RandomNumberGenerator.new()

func setup(view: Node2D) -> void:
	tank = view
	tank.tank_built.connect(rebuild)
	demo = "--demo-feed" in OS.get_cmdline_user_args() or "--demo-feed" in OS.get_cmdline_args()

func rebuild() -> void:
	fishes.clear()
	brains.clear()
	pellets.clear()
	frame = 0
	rng.seed = 12012
	for layer: Node2D in tank.fish_layers():
		for fish in layer.get_children():
			fishes.append(fish)
			brains.append(fish.brain)
	boids.rebuild(brains)

func _process(delta: float) -> void:
	if not is_instance_valid(tank) or fishes.is_empty():
		return
	frame += 1
	if demo:
		if frame == 60:
			feed(tank.get_water_rect().position + tank.get_water_rect().size * Vector2(0.52, 0.22))
		elif frame == 180:
			tap(tank.get_water_rect().get_center())
		elif frame == 240:
			fishes[0].highlight(true)
			demo_fish_selected.emit(fishes[0])
	step(minf(delta, 0.05))

func step(delta: float) -> void:
	var started := Time.get_ticks_usec()
	boids.rebuild(brains)
	pellets = pellets.filter(func(p: Variant) -> bool: return is_instance_valid(p) and not p.consumed)
	for pellet in pellets:
		pellet.advance(delta)
	for fish in fishes:
		var brain: RefCounted = fish.brain
		# Alternate neighbor work for each fish, retaining the previous force.
		if (frame + brain.id) % 2 == 0:
			if brain.profile.behavior == "school" or brain.species == "guppy":
				brain.school_force = boids.steering(brain)
			brain.social_force = Vector2.ZERO
			for entry: Dictionary in boids.neighbors(brain.point, 30, "", brain.id):
				var away: Vector2 = brain.point - entry.point
				var distance := away.length()
				if distance > 0.01 and distance < 18:
					brain.social_force += away / distance * (18 - distance) * 1.5
				# Mild territorial pursuit, with the visitor steering away; no damage.
				if brain.species == "betta" and entry.species != "betta" and distance > 12:
					brain.social_force -= away.normalized() * 7
				elif entry.species == "betta" and brain.species != "betta":
					brain.social_force += away.normalized() * 15
		if brain.state not in ["flee", "eat", "surface_gulp"]:
			var closest: Variant = null
			var distance_sq := 160.0 * 160.0
			for pellet in pellets:
				if pellet.consumed or (brain.is_bottom() and not pellet.grounded):
					continue
				var d: float = brain.point.distance_squared_to(pellet.point)
				if d < distance_sq:
					distance_sq = d
					closest = pellet
			if closest != null:
				brain.seek_food(closest)
		brain.step(delta)
		fish.advance_visual(delta)
	last_step_usec = Time.get_ticks_usec() - started

func feed(at: Vector2) -> void:
	if not tank.get_water_rect().has_point(at):
		return
	for index in range(rng.randi_range(6, 10)):
		var pellet := FOOD.instantiate()
		tank.get_node("Particles").add_child(pellet)
		pellet.setup((at + Vector2(rng.randf_range(-10, 10), rng.randf_range(-3, 3))).clamp(tank.get_water_rect().position + Vector2(4, 4), tank.get_water_rect().end - Vector2(4, 4)), tank.get_water_rect(), tank.get_substrate_y, rng.randf() * TAU)
		pellets.append(pellet)
	# Once per click/batch, never per pellet or per fish eating.
	get_node("/root/Bridge").send("action:feed", {"at": int(Time.get_unix_time_from_system())})

func tap(at: Vector2) -> void:
	var ripple := Ripple.new()
	ripple.position = at.round()
	ripple.water = tank.get_water_rect()
	tank.get_node("Particles").add_child(ripple)
	for brain in brains:
		if brain.point.distance_squared_to(at) <= 120 * 120:
			brain.flee(at)

func pick(at: Vector2) -> Node2D:
	# FishFront first; reverse order matches painter order within each layer.
	var layers: Array = tank.fish_layers()
	layers.reverse()
	for layer: Node2D in layers:
		var children := layer.get_children()
		children.reverse()
		for fish in children:
			if fish.hit_test(at):
				return fish
	return null
