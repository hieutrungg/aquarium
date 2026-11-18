extends RefCounted
## Rebuilt from a snapshot before stepping any brain. No scene/render dependency.
const CELL_SIZE := 32.0
var cells: Dictionary = {}

func rebuild(brains: Array) -> void:
	cells.clear()
	for brain in brains:
		var cell := Vector2i(floori(brain.point.x / CELL_SIZE), floori(brain.point.y / CELL_SIZE))
		if not cells.has(cell):
			cells[cell] = []
		cells[cell].append({"id": brain.id, "species": brain.species, "point": brain.point, "velocity": brain.velocity})

func neighbors(point: Vector2, radius: float, species: String = "", exclude_id: int = -1) -> Array:
	var result: Array = []
	var low := Vector2i(floori((point.x - radius) / CELL_SIZE), floori((point.y - radius) / CELL_SIZE))
	var high := Vector2i(floori((point.x + radius) / CELL_SIZE), floori((point.y + radius) / CELL_SIZE))
	for x in range(low.x, high.x + 1):
		for y in range(low.y, high.y + 1):
			for entry: Dictionary in cells.get(Vector2i(x, y), []):
				if entry.id != exclude_id and (species.is_empty() or entry.species == species) and point.distance_squared_to(entry.point) <= radius * radius:
					result.append(entry)
	return result

func steering(brain: RefCounted) -> Vector2:
	var nearby := neighbors(brain.point, float(brain.profile.schoolRadius), brain.species, brain.id)
	if nearby.is_empty():
		return Vector2.ZERO
	var center := Vector2.ZERO
	var alignment := Vector2.ZERO
	var separate := Vector2.ZERO
	for entry: Dictionary in nearby:
		center += entry.point
		alignment += entry.velocity
		var away: Vector2 = brain.point - entry.point
		var distance := away.length()
		if distance < 26 and distance > 0.01:
			separate += away / distance * (26 - distance) / 26.0
	center /= nearby.size()
	alignment /= nearby.size()
	var tight: bool = brain.profile.get("tightSchool", false)
	return (center - brain.point) * (1.1 if tight else 0.65) + alignment * (1.8 if tight else 0.8) + separate * float(brain.profile.speed) * (0.8 if tight else 1.5)
