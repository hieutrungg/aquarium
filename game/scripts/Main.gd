extends Node2D

@onready var camera: Camera2D = $Camera2D
@onready var tank_view: Node2D = $TankView
@onready var status: Label = $HUD/Status

var _camera_x := 320.0
var _pan_range := 0.0
var _dragging := false


func _ready() -> void:
	Bridge.scene_loaded.connect(_on_scene_loaded)
	$HUD/Feed.pressed.connect(func() -> void: print("Cho ăn (Phase 0)"))


func _on_scene_loaded(dto: Dictionary) -> void:
	var tank: Dictionary = dto.get("tank", {})
	status.text = "%s · %s · %d cá" % [tank.get("name", "Bể cá"), tank.get("style", "nature"), tank_view.fish_count]
	var size: Vector2 = get_node("/root/SceneState").scene_size()
	_pan_range = maxf(0.0, (size.x - 640.0) / 2.0)
	_camera_x = 320.0
	_dragging = false
	camera.position = Vector2(_camera_x, 180)


func _process(delta: float) -> void:
	var direction := float(Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_LEFT))
	_camera_x = clampf(_camera_x + direction * 180.0 * delta, 320.0 - _pan_range, 320.0 + _pan_range)
	camera.position.x = roundf(_camera_x)
	if not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_dragging = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging and _pan_range > 0.0:
		_camera_x = clampf(_camera_x - event.relative.x, 320.0 - _pan_range, 320.0 + _pan_range)
