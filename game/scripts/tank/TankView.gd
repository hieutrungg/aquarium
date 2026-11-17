extends Node2D

const Fish := preload("res://scripts/fish/PlaceholderFish.gd")
const MAX_FISH := 120

var water_rect := Rect2(Vector2(20, 44), Vector2(600, 300))
var fish_count := 0


func _ready() -> void:
	Bridge.scene_loaded.connect(_on_scene_loaded)


func _on_scene_loaded(dto: Dictionary) -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()
	fish_count = 0
	# SceneState is also an engine resource class, so resolve our autoload by path.
	var size: Vector2 = get_node("/root/SceneState").scene_size()
	water_rect = Rect2(Vector2(roundf((640.0 - size.x) / 2.0), 44), size)
	for item: Dictionary in dto.get("livestock", []):
		var quantity := clampi(int(item.get("quantity", 0)), 0, MAX_FISH - fish_count)
		for index in range(quantity):
			var fish := Fish.new()
			fish.setup(str(item.get("speciesKey", "unknown")), item.get("render", {}), water_rect)
			add_child(fish)
			fish_count += 1
		if fish_count >= MAX_FISH:
			break
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(-1200, 0, 3040, 360), Color("76B5A5"))
	draw_rect(water_rect, Color("B8E1D5"))
	draw_rect(Rect2(water_rect.position + Vector2(0, water_rect.size.y - 24), Vector2(water_rect.size.x, 24)), Color("E8D9B5"))
	draw_rect(water_rect.grow(1), Color("35574F"), false, 2.0)
	draw_line(water_rect.position + Vector2(1, 1), Vector2(water_rect.end.x - 1, water_rect.position.y + 1), Color("D6F0E8"), 1.0)
