extends Node

signal scene_loaded(dto: Dictionary)
signal message_received(type: String, payload: Variant)
signal message_sent(type: String, payload: Variant)

var current_dto: Dictionary = {}
var applying_patch := false

# Keep both JavaScript functions alive for the lifetime of the listener.
var _callback: JavaScriptObject
var _listener: JavaScriptObject
var _window: JavaScriptObject


func _ready() -> void:
	if OS.has_feature("web"):
		_window = JavaScriptBridge.get_interface("window")
		_callback = JavaScriptBridge.create_callback(_on_web_message)
		# Filter in JS, where === compares the actual browser Window identities.
		# eval() only returns primitives/buffers; obtain the temporary object via get_interface.
		JavaScriptBridge.eval("""window.__aquaverseBridgeFactory = { createListener(callback) {
			return function(event) {
				if (event.origin !== window.location.origin || event.source !== window.parent) return;
				const data = event.data;
				if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string') return;
				try { callback(JSON.stringify(data)); } catch (_) { /* Ignore non-JSON messages. */ }
			};
		} };""", true)
		var factory = JavaScriptBridge.get_interface("__aquaverseBridgeFactory")
		_listener = factory.createListener(_callback)
		JavaScriptBridge.eval("delete window.__aquaverseBridgeFactory;", true)
		_window.addEventListener("message", _listener)
	# Main and all scene consumers must be connected before publishing anything.
	await get_tree().process_frame
	if OS.has_feature("web") and _is_embedded():
		send("ready", {"version": 1})
	else:
		# Desktop editor runs, or the web build opened directly (not inside the React iframe): show the demo scene.
		_load_dev_scene()


func _is_embedded() -> bool:
	return bool(JavaScriptBridge.eval("window.parent !== window", true))


func _load_dev_scene() -> void:
	var stress := "--stress" in OS.get_cmdline_user_args() or "--stress" in OS.get_cmdline_args()
	var path := "res://data/dev/sample_scene_stress.json" if stress else "res://data/dev/sample_scene_nature.json"
	var style_key := "nature"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--style="):
			style_key = arg.trim_prefix("--style=")
	if OS.has_feature("web") and not _is_embedded():
		var query: Variant = JavaScriptBridge.eval("new URLSearchParams(location.search).get('style') || 'nature'", true)
		style_key = str(query)
	style_key = str(preload("res://scripts/tank/StyleLibrary.gd").load_style(style_key).key)
	if not stress and style_key in ["dutch", "lowtech"]:
		path = "res://data/dev/sample_scene_%s.json" % style_key
	var json := FileAccess.get_file_as_string(path)
	var dto: Variant = JSON.parse_string(json)
	if dto is Dictionary:
		if not stress and style_key not in ["nature", "dutch", "lowtech"]:
			dto.tank.style = style_key
			dto.tank.id = "dev-" + style_key
			dto.plants = []
			dto.hardscape = []
			dto.scene.props = []
		_receive("scene:load", dto)
	else:
		push_error("Cannot read " + path)


func send(type: String, payload: Variant = {}) -> void:
	message_sent.emit(type, payload)
	if OS.has_feature("web") and _window != null:
		var json = JavaScriptBridge.get_interface("JSON")
		var message = json.parse(JSON.stringify({"type": type, "payload": payload}))
		_window.parent.postMessage(message, _window.location.origin)
	else:
		print("Bridge -> ", type, ": ", payload)


func _on_web_message(args: Array) -> void:
	if args.is_empty() or not args[0] is String:
		return
	var message: Variant = JSON.parse_string(args[0])
	if message is Dictionary and message.get("type") is String:
		_receive(message["type"], message.get("payload"))


func _receive(type: String, payload: Variant) -> void:
	message_received.emit(type, payload)
	if type == "scene:load" and payload is Dictionary:
		current_dto = payload.duplicate(true)
		scene_loaded.emit(current_dto)
	elif type == "scene:patch" and payload is Dictionary:
		current_dto = merge_patch(current_dto, payload)
		applying_patch = true
		scene_loaded.emit(current_dto)
		applying_patch = false


static func merge_patch(dto: Dictionary, patch: Dictionary) -> Dictionary:
	var merged := dto.duplicate(true)
	merged.merge(patch.duplicate(true), true)
	return merged


func remember_scene(scene: Dictionary) -> void:
	# Keep desktop saves and later partial patches on the same layout.
	current_dto["scene"] = scene.duplicate(true)
	get_node("/root/SceneState").current_dto["scene"] = scene.duplicate(true)


func _exit_tree() -> void:
	if _window != null and _listener != null:
		_window.removeEventListener("message", _listener)
