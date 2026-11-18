extends Node2D

const World := preload("res://scripts/fish/FishWorld.gd")
const INFO := preload("res://scenes/ui/info_card.tscn")
const Solver := preload("res://scripts/tank/LayoutSolver.gd")
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
var editing := false
var _layout_before: Array[Dictionary] = []
var _camera_before := 320.0
var _selected_prop := -1
var _prop_dragging := false
var _prop_grab := Vector2.ZERO
var _toolbar: HBoxContainer
var _edit_hint: Label
var _warnings: Label

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
	_setup_layout_hud()

func set_feeding(enabled: bool) -> void:
	feeding = enabled and not editing
	$HUD/Feed.text = "Thả mồi…" if feeding else "Cho ăn"
	$HUD/Feed.tooltip_text = "Click trong nước để thả mồi · Esc để hủy" if feeding else "Cho ăn (F)"
	if feeding:
		info.hide()

func _on_scene_loaded(dto: Dictionary) -> void:
	var patch: bool = Bridge.applying_patch
	var was_feeding := feeding
	var follow_id := str(followed.dto.get("id", "")) if is_instance_valid(followed) else ""
	var follow_key := str(followed.species_key) if is_instance_valid(followed) else ""
	var previous_zoom := camera.zoom
	var previous_y := camera.position.y
	var card_fish: Node2D = info.displayed_fish if info.visible else null
	var card_id := str(card_fish.dto.get("id", "")) if is_instance_valid(card_fish) else ""
	var card_key := str(card_fish.species_key) if is_instance_valid(card_fish) else ""
	if editing:
		_end_edit()
	var tank: Dictionary = dto.get("tank", {})
	status.text = "%s · %s · %d cá" % [tank.get("name", "Bể cá"), tank.get("style", "nature"), tank_view.fish_count]
	_water = dto.get("water") if dto.get("water") is Dictionary else {}
	var warning_list: Array = dto.get("warnings", [])
	_warnings.text = "Cảnh báo %d" % warning_list.size()
	var messages := PackedStringArray()
	for warning: Dictionary in warning_list:
		messages.append(str(warning.get("message", "")))
	_warnings.tooltip_text = "\n".join(messages)
	var size: Vector2 = get_node("/root/SceneState").scene_size()
	_pan_range = maxf(0.0, (size.x - 640.0) / 2.0)
	if not patch:
		_camera_x = 320.0 + float(dto.get("scene", {}).get("camera", {}).get("x", 0))
	var margin := 320.0 - 320.0 / previous_zoom.x if patch else 0.0
	_camera_x = clampf(_camera_x, 320.0 - _pan_range - margin, 320.0 + _pan_range + margin)
	_dragging = false
	followed = null
	hovered = null
	info.hide()
	set_feeding(false)
	camera.position = Vector2(_camera_x, 180)
	camera.zoom = Vector2.ONE
	if patch:
		set_feeding(was_feeding)
		for fish in world.fishes:
			if not follow_key.is_empty() and fish.species_key == follow_key and (follow_id.is_empty() or str(fish.dto.get("id", "")) == follow_id):
				followed = fish
				camera.zoom = previous_zoom
				camera.position.y = previous_y
				break
		for fish in world.fishes:
			if not card_key.is_empty() and fish.species_key == card_key and (card_id.is_empty() or str(fish.dto.get("id", "")) == card_id):
				info.show_fish(fish, _water)
				break

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
		_prop_dragging = false
	if editing:
		if not _prop_dragging:
			var target: int = tank_view.pick_prop(get_global_mouse_position()) if get_viewport().gui_get_hovered_control() == null else -1
			tank_view.highlight_prop(target)
			if target >= 0:
				_selected_prop = target
		return
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
	if editing:
		return
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
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_E:
		cancel_layout() if editing else begin_layout()
		get_viewport().set_input_as_handled()
		return
	if editing:
		_layout_input(event)
		return
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


func _setup_layout_hud() -> void:
	var cozy := preload("res://ui/cozy_theme.tres")
	$HUD/Status.offset_right = 330
	var edit := Button.new()
	edit.name = "Arrange"
	edit.text = "Sắp xếp"
	edit.tooltip_text = "Sắp xếp cây và đá (E)"
	edit.position = Vector2(446, 8)
	edit.size = Vector2(88, 26)
	edit.theme = cozy
	edit.pressed.connect(func() -> void: cancel_layout() if editing else begin_layout())
	$HUD.add_child(edit)
	_warnings = Label.new()
	_warnings.name = "Warnings"
	_warnings.position = Vector2(338, 8)
	_warnings.size = Vector2(100, 26)
	_warnings.custom_minimum_size = Vector2(100, 26)
	_warnings.clip_text = true
	_warnings.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_warnings.theme = cozy
	_warnings.mouse_filter = Control.MOUSE_FILTER_STOP
	$HUD.add_child(_warnings)
	_toolbar = HBoxContainer.new()
	_toolbar.position = Vector2(12, 40)
	_toolbar.theme = cozy
	_toolbar.add_theme_constant_override("separation", 6)
	$HUD.add_child(_toolbar)
	var actions := [save_layout, cancel_layout, auto_layout, flip_prop, func() -> void: cycle_layer(-1), func() -> void: cycle_layer(1)]
	var labels := ["Lưu", "Huỷ", "Tự xếp lại", "Lật (F)", "Lớp [", "Lớp ]"]
	for index in range(labels.size()):
		var button := Button.new()
		button.text = labels[index]
		button.custom_minimum_size.y = 26
		button.pressed.connect(actions[index])
		if index > 0:
			button.add_theme_stylebox_override("normal", cozy.get_stylebox("hover", "Button"))
		_toolbar.add_child(button)
	_edit_hint = Label.new()
	_edit_hint.position = Vector2(12, 72)
	_edit_hint.theme = cozy
	_edit_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	$HUD.add_child(_edit_hint)
	_toolbar.hide()
	_edit_hint.hide()


func begin_layout() -> void:
	close_interactions()
	_dragging = false
	if is_instance_valid(hovered):
		hovered.highlight(false)
	hovered = null
	editing = true
	world.interactions_enabled = false
	_layout_before = tank_view.layout.duplicate(true)
	_camera_before = _camera_x
	_selected_prop = -1
	$HUD/Feed.disabled = true
	_toolbar.show()
	_edit_hint.text = "Kéo ngang · Shift: giữ độ cao · F: lật · [ ]: đổi lớp"
	_edit_hint.show()


func _end_edit() -> void:
	editing = false
	world.interactions_enabled = true
	_prop_dragging = false
	_selected_prop = -1
	tank_view.highlight_prop(-1)
	$HUD/Feed.disabled = false
	_toolbar.hide()
	_edit_hint.hide()


func scene_payload() -> Dictionary:
	return {"props": Solver.serialize(tank_view.layout), "camera": {"x": roundi(_camera_x - 320.0)}}


func save_layout() -> void:
	if not editing:
		return
	var payload := scene_payload()
	Bridge.remember_scene(payload)
	Bridge.send("scene:save", payload)
	_end_edit()


func cancel_layout() -> void:
	if not editing:
		return
	tank_view.layout = _layout_before.duplicate(true)
	tank_view.refresh_props()
	_camera_x = _camera_before
	camera.position.x = roundf(_camera_x)
	_end_edit()


func auto_layout() -> void:
	var dto: Dictionary = Bridge.current_dto.duplicate(true)
	dto["scene"] = {"props": []}
	tank_view.layout = Solver.solve(dto, tank_view.style, tank_view.water_rect, tank_view.get_substrate_y)
	tank_view.refresh_props()
	_selected_prop = -1
	_prop_dragging = false


func move_prop(index: int, point: Vector2, custom_y: bool) -> void:
	var x := clampf(snappedf(point.x, 4), ceilf(tank_view.water_rect.position.x / 4) * 4, floorf(tank_view.water_rect.end.x / 4) * 4)
	var prop: Dictionary = tank_view.layout[index]
	prop.position = Vector2(x, roundf(point.y) if custom_y else tank_view.get_substrate_y(x))
	if prop.get("band", "") == "floating":
		prop.position.y = tank_view.water_rect.position.y + float(preload("res://scripts/tank/PlantLibrary.gd").profile(prop.key).heightPx)
	tank_view.update_prop(index)


func flip_prop() -> void:
	if _selected_prop >= 0:
		tank_view.layout[_selected_prop].flip = not tank_view.layout[_selected_prop].flip
		tank_view.update_prop(_selected_prop)


func cycle_layer(direction: int) -> void:
	if _selected_prop < 0:
		return
	var prop: Dictionary = tank_view.layout[_selected_prop]
	if prop.get("band", "") == "floating":
		return
	var layers := ["PlantsBack", "PlantsMid", "PlantsFront"] if prop.refType == "plant" else ["HardscapeBack", "HardscapeMid"]
	prop.layer = layers[clampi(layers.find(prop.layer) + direction, 0, layers.size() - 1)]
	tank_view.update_prop(_selected_prop)


func _layout_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_F: flip_prop()
			KEY_BRACKETLEFT: cycle_layer(-1)
			KEY_BRACKETRIGHT: cycle_layer(1)
			KEY_DELETE: _edit_hint.text = "Xoá ở trang quản lý"
			KEY_ESCAPE: cancel_layout()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_prop_dragging = false
		if event.pressed:
			_selected_prop = tank_view.pick_prop(get_global_mouse_position())
			_prop_dragging = _selected_prop >= 0
			if _prop_dragging:
				_prop_grab = get_global_mouse_position() - tank_view.layout[_selected_prop].position
				tank_view.highlight_prop(_selected_prop)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _prop_dragging:
		move_prop(_selected_prop, get_global_mouse_position() - _prop_grab, event.shift_pressed)
		get_viewport().set_input_as_handled()
