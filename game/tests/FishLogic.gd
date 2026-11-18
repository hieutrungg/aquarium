extends SceneTree
const Brain := preload("res://scripts/fish/FishBrain.gd")
const Hash := preload("res://scripts/fish/Boids.gd")
const Profiles := preload("res://scripts/fish/SpeciesProfiles.gd")
var failed := false

func check(condition: bool, message: String) -> void:
	if not condition:
		failed = true
		push_error(message)

func _initialize() -> void:
	var water := Rect2(-80, 44, 650, 300)
	var ground := func(x: float) -> float: return 308 + roundf(sin(x * 0.008) * 9)
	var brains: Array = []
	var keys := ["neon_tetra", "betta", "angelfish", "guppy", "panda_cory"]
	for index in range(120):
		var brain := Brain.new()
		var key: String = keys[index % 5]
		brain.setup(key, Profiles.resolve(key), water, ground, index, 12012 + index)
		brains.append(brain)
	# Explicit cell edges, negative coordinates, equal-radius inclusion and exclusion.
	brains[0].point = Vector2(-32, 100)
	brains[5].point = Vector2(0, 100)
	brains[10].point = Vector2(0.1, 100)
	var hash_grid := Hash.new()
	hash_grid.rebuild(brains)
	for radius in [0.0, 18.0, 32.0, 92.0, 160.0]:
		for brain in brains:
			var actual: Array = hash_grid.neighbors(brain.point, radius, brain.species, brain.id).map(func(entry: Dictionary) -> int: return int(entry.id))
			var expected: Array = []
			for other in brains:
				if other.id != brain.id and other.species == brain.species and brain.point.distance_squared_to(other.point) <= radius * radius:
					expected.append(other.id)
			actual.sort()
			expected.sort()
			check(actual == expected, "spatial hash differs from brute force")
	var gulps := 0
	for frame in range(2000):
		hash_grid.rebuild(brains)
		for brain in brains:
			if (frame + brain.id) % 2 == 0:
				brain.school_force = hash_grid.steering(brain)
			if frame % 157 == 0:
				brain.flee(brain.point + Vector2(4, 2))
			if frame == 50 and brain.species == "panda_cory":
				brain.gulp_timer = 0
			brain.step(1.0 / 30)
			check(brain.point.x >= brain.bounds.position.x and brain.point.x <= brain.bounds.end.x and brain.point.y >= brain.bounds.position.y and brain.point.y <= brain.bounds.end.y, "escaped water after step %d" % frame)
			check(brain.point.y <= ground.call(brain.point.x), "under substrate")
			if brain.species == "panda_cory":
				if brain.state == "surface_gulp":
					gulps += 1
				else:
					check(ground.call(brain.point.x) - brain.point.y <= 12.001, "Cory more than 12px above substrate")
	check(gulps > 0, "air gulp was never exercised")
	check(Profiles.resolve("betta", {"speed": 0.6}).speed == 7.8, "DTO speed multiplier")
	check(Profiles.resolve("angelfish").behavior == "hover", "default angel hover")
	print("FishLogic: spatial hash vs brute force; 120 fish x 2000 steps; bounds, substrate, Cory gulp: ", "FAIL" if failed else "PASS")
	quit(1 if failed else 0)
