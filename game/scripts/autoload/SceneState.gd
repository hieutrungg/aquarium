extends Node

var current_dto: Dictionary = {}


func _ready() -> void:
	Bridge.scene_loaded.connect(_on_scene_loaded)


func _on_scene_loaded(dto: Dictionary) -> void:
	current_dto = dto.duplicate(true)


func scene_size() -> Vector2:
	var dimensions: Dictionary = current_dto.get("tank", {}).get("dimensions", {})
	var length := float(dimensions.get("length", 0.0))
	var height := float(dimensions.get("height", 0.0))
	if length <= 0.0 or height <= 0.0:
		return Vector2(600, 300)
	return Vector2(clampf(300.0 * length / height, 400.0, 1200.0), 300)
