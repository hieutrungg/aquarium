extends Node2D

const World := preload("res://scripts/fish/FishWorld.gd")
const INFO := preload("res://scenes/ui/info_card.tscn")
@onready var camera: Camera2D = $Camera2D
@onready var tank_view: Node2D = $TankView
@onready var status: Label = $HUD/Status
var world: Node
var info: PanelContainer
var feeding := false
var followed: Node2D
var hovered: Node2D
var _camera_x := 320.0
var _pan_range := 0.0
var _dragging := false
var _drag_distance := 0.0
var _press_point := Vector2.ZERO
var _water: Dictionary = {}
var _perf := false
var _perf_timer := 0.0

func _ready() -> void:
	# Perf overlay in the console: desktop `-- --perf`, web `index.html?perf`.
	_perf = "--perf" in OS.get_cmdline_user_args()
	if OS.has_feature("web"):
		_perf = bool(JavaScriptBridge.eval("location.search.includes('perf')", true))
	world = World.new()
	add_child(world)
	world.setup(tank_view)
	info = INFO.instantiate()
	$HUD.add_child(info)
	world.demo_fish_selected.connect(func(fish: Node2D) -> void: info.show_fish(fish, _water))
	Bridge.scene_loaded.connect(_on_scene_loaded)
	$HUD/Feed.pressed.connect(func() -> void: set_feeding(not feeding))

func set_feeding(enabled: bool) -> void:
	feeding = enabled
	$HUD/Feed.text = "Thả mồi…" if feeding else "Cho ăn"
	$HUD/Feed.tooltip_text = "Click trong nước để thả mồi · Esc để hủy" if feeding else "Cho ăn (F)"
	if feeding:
		info.hide()

func _on_scene_loaded(dto: Dictionary) -> void:
	var tank: Dictionary = dto.get("tank", {})
	status.text = "%s · %s · %d cá" % [tank.get("name", "Bể cá"), tank.get("style", "nature"), tank_view.fish_count]
	_water = dto.get("water", {})
	var size: Vector2 = get_node("/root/SceneState").scene_size()
	_pan_range = maxf(0.0, (size.x - 640.0) / 2.0)
	_camera_x = 320.0
	_dragging = false
	followed = null
	hovered = null
	info.hide()
	set_feeding(false)
	camera.position = Vector2(_camera_x, 180)
	camera.zoom = Vector2.ONE

func _process(delta: float) -> void:
	if _perf:
		_perf_timer += delta
		if _perf_timer >= 2.0:
			_perf_timer = 0.0
			print("[perf] fps=%d process=%.2fms fish_step=%.2fms draw_calls=%d objects=%d" % [
				Engine.get_frames_per_second(),
				Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
				world.last_step_usec / 1000.0,
				Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
				Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)])
			for layer in tank_view.get_children():
				print("[perf]   %s: %d nodes" % [layer.name, _count_nodes(layer)])
	if is_instance_valid(followed):
		var zoom_margin := 320.0 - 320.0 / camera.zoom.x
		_camera_x = clampf(followed.position.x, 320.0 - _pan_range - zoom_margin, 320.0 + _pan_range + zoom_margin)
	else:
		var direction := float(Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_LEFT))
		_camera_x = clampf(_camera_x + direction * 180.0 * delta, 320.0 - _pan_range, 320.0 + _pan_range)
	camera.position.x = roundf(_camera_x)
	# With no horizontal pan room, modest zoom makes follow observable in a 60cm tank.
	var follow_y := 180.0
	if is_instance_valid(followed):
		follow_y = clampf(followed.position.y, 150, 210)
	camera.position.y = roundf(follow_y)
	if not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_dragging = false
	var next: Node2D = null
	var screen_point := get_viewport().get_mouse_position()
	if not feeding and not (info.visible and info.get_global_rect().has_point(screen_point)) and screen_point.y > 36:
		next = world.pick(get_global_mouse_position())
	if next != hovered:
		if is_instance_valid(hovered):
			hovered.highlight(false)
		hovered = next
		if is_instance_valid(hovered):
			hovered.highlight(true)

func _count_nodes(node: Node) -> int:
	var total := 1
	for child in node.get_children():
		total += _count_nodes(child)
	return total

func close_interactions() -> void:
	info.hide()
	followed = null
	camera.zoom = Vector2.ONE
	set_feeding(false)

func click_water(at: Vector2, double_click: bool = false) -> void:
	if feeding and tank_view.get_water_rect().has_point(at):
		world.feed(at)
		set_feeding(false)
		return
	var fish: Node2D = world.pick(at)
	if fish != null:
		info.show_fish(fish, _water)
		if double_click:
			followed = fish
			camera.zoom = Vector2(1.25, 1.25)
		return
	info.hide()
	if tank_view.get_water_rect().has_point(at):
		world.tap(at)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F:
			set_feeding(not feeding)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_ESCAPE:
			close_interactions()
			get_viewport().set_input_as_handled()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_dragging = true
			_drag_distance = 0
			_press_point = get_global_mouse_position()
			if event.double_click:
				click_water(_press_point, true)
				_dragging = false
		elif _dragging:
			_dragging = false
			if _drag_distance < 4:
				click_water(_press_point)
	elif event is InputEventMouseMotion and _dragging:
		_drag_distance += event.relative.length()
		if _pan_range > 0 and _drag_distance >= 4:
			followed = null
			camera.zoom = Vector2.ONE
			_camera_x = clampf(_camera_x - event.relative.x, 320.0 - _pan_range, 320.0 + _pan_range)
