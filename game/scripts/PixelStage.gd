extends Control
## Native window clears mint; only the inner 640x360 viewport is integer-scaled.
## Engine-provided stretch margins are black and cannot be styled with Web CSS.

const BASE := Vector2i(640, 360)
@onready var frame: SubViewportContainer = $Frame


func _ready() -> void:
	var window := get_window()
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	window.content_scale_size = Vector2i.ZERO
	RenderingServer.set_default_clear_color(Color("EAF6F2"))
	window.size_changed.connect(_fit)
	_fit()


func _fit() -> void:
	var available := get_window().size
	var fit := minf(float(available.x) / BASE.x, float(available.y) / BASE.y)
	# Integer scale keeps pixels crisp once 2x fits; below that, a 1x frame would fill only
	# about half of a HiDPI iframe, so fill the space with a fractional scale instead.
	var factor := float(floori(fit)) if fit >= 2.0 else maxf(fit, 0.5)
	frame.scale = Vector2.ONE * factor
	frame.position = ((Vector2(available) - Vector2(BASE) * factor) / 2).floor()
