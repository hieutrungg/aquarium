extends RefCounted
## Native-size, palette-only fallbacks, generated in memory rather than assets/.

const SIZES := {"seiryu_l": Vector2i(96, 64), "seiryu_m": Vector2i(64, 48),
	"seiryu_s": Vector2i(32, 24), "driftwood_branch": Vector2i(128, 96),
	"carpet_grass": Vector2i(64, 16), "anubias": Vector2i(48, 40),
	"java_fern": Vector2i(48, 64), "rotala": Vector2i(32, 96),
	"vallisneria": Vector2i(32, 112), "moss": Vector2i(32, 16),
	"ludwigia_red": Vector2i(32, 96), "alternanthera": Vector2i(40, 48),
	"hygrophila": Vector2i(32, 104), "dwarf_sag": Vector2i(64, 20),
	"cryptocoryne": Vector2i(40, 40), "bucephalandra": Vector2i(28, 20),
	"hornwort": Vector2i(32, 112), "frogbit": Vector2i(48, 32)}
static var _cache: Dictionary = {}


static func asset(kind: String, key: String) -> Dictionary:
	var safe_key := key if key.is_valid_filename() and not key.contains(".") else "unknown"
	var cache_key := kind + "/" + safe_key
	if _cache.has(cache_key):
		return _cache[cache_key]
	var path := "res://assets/%s/%s" % [kind, safe_key]
	var texture: Texture2D
	if ResourceLoader.exists(path + ".png"):
		texture = load(path + ".png") as Texture2D
	if texture == null:
		texture = ImageTexture.create_from_image(_fallback(kind, safe_key))
	var pivot := Vector2(texture.get_width() / 2.0, texture.get_height())
	if FileAccess.file_exists(path + ".json"):
		var meta: Variant = JSON.parse_string(FileAccess.get_file_as_string(path + ".json"))
		if meta is Dictionary and meta.get("pivot") is Dictionary:
			pivot = Vector2(float(meta.pivot.get("x", pivot.x)), float(meta.pivot.get("y", pivot.y)))
	# Gutters accommodate sway and the editor's one-pixel silhouette outline.
	if kind in ["plants", "hardscape"]:
		var original := texture.get_image()
		if original.is_compressed():
			original.decompress()
		if original.get_format() != Image.FORMAT_RGBA8:
			original.convert(Image.FORMAT_RGBA8)
		var padded := Image.create(original.get_width() + 4, original.get_height() + 4, false, Image.FORMAT_RGBA8)
		padded.blit_rect(original, Rect2i(Vector2i.ZERO, original.get_size()), Vector2i(2, 2))
		texture = ImageTexture.create_from_image(padded)
		pivot += Vector2(2, 2)
	var result := {"texture": texture, "pivot": pivot.round()}
	_cache[cache_key] = result
	return result


static func tile(key: String, fill: Color, grain: Color) -> Texture2D:
	var path := "res://assets/tiles/%s.png" % key
	if key.is_valid_filename() and not key.contains(".") and ResourceLoader.exists(path):
		return load(path) as Texture2D
	var image := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	image.fill(fill)
	var rng := RandomNumberGenerator.new()
	rng.seed = key.hash()
	for index in range(35):
		var p := Vector2i(rng.randi_range(0, 15), rng.randi_range(0, 15))
		image.set_pixelv(p, grain)
		if key == "gravel" and p.x < 15:
			image.set_pixelv(p + Vector2i.RIGHT, Color("9C8463"))
	return ImageTexture.create_from_image(image)


static func _fallback(kind: String, key: String) -> Image:
	var size: Vector2i = SIZES.get(key, Vector2i(48, 64) if kind == "plants" else Vector2i(64, 48))
	var image := Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = key.hash()
	if kind == "plants":
		_plant(image, key, rng)
	elif key == "driftwood_branch":
		_wood(image)
	else:
		_rock(image, rng)
	return image


static func _polygon(image: Image, points: PackedVector2Array, color: Color) -> void:
	var bounds := Rect2(points[0], Vector2.ZERO)
	for point in points:
		bounds = bounds.expand(point)
	for y in range(maxi(0, int(bounds.position.y)), mini(image.get_height(), ceili(bounds.end.y) + 1)):
		for x in range(maxi(0, int(bounds.position.x)), mini(image.get_width(), ceili(bounds.end.x) + 1)):
			if Geometry2D.is_point_in_polygon(Vector2(x + 0.5, y + 0.5), points):
				image.set_pixel(x, y, color)


static func _line(image: Image, from: Vector2, to: Vector2, color: Color, width: int = 1) -> void:
	var steps := maxi(1, ceili(from.distance_to(to)))
	for step in range(steps + 1):
		var p := Vector2i(from.lerp(to, float(step) / steps).round())
		for y in range(width):
			for x in range(width):
				var q := p + Vector2i(x - int(width / 2.0), y - int(width / 2.0))
				if q.x >= 0 and q.x < image.get_width() and q.y >= 0 and q.y < image.get_height():
					image.set_pixelv(q, color)


static func _leaf(image: Image, base: Vector2, tip: Vector2, width: float, color: Color) -> void:
	var axis := tip - base
	var normal := axis.normalized().orthogonal() * width
	_polygon(image, PackedVector2Array([base, base + axis * 0.35 + normal,
		base + axis * 0.73 + normal * 0.5, tip,
		base + axis * 0.64 - normal * 0.6, base + axis * 0.26 - normal * 0.65]), color)
	_line(image, base, tip - axis * 0.22, Color("7FA86A"))


static func _plant(image: Image, key: String, rng: RandomNumberGenerator) -> void:
	var w := float(image.get_width())
	var h := float(image.get_height())
	var greens: Array[Color] = [Color("3F6B4A"), Color("5E8C61"), Color("7FA86A"), Color("A8C686")]
	if key in ["ludwigia_red", "alternanthera"]:
		greens = [Color("6B5241"), Color("D9534F"), Color("F07C6C"), Color("F2B77E")]
	if key == "frogbit":
		for i in range(7):
			var root := Vector2(7 + i * 5, 6)
			_line(image, root, root + Vector2(rng.randf_range(-3, 3), rng.randf_range(16, 25)), Color("9C8463"))
		for i in range(5):
			_leaf(image, Vector2(6 + i * 8, 8), Vector2(11 + i * 8, 2), 5, greens[1 + i % 3])
	elif key in ["carpet_grass", "moss", "dwarf_sag"]:
		for index in range(int(w * 1.7)):
			var base := Vector2(rng.randf_range(2, w - 2), h)
			var tip := base + Vector2(rng.randf_range(-4, 4), -rng.randf_range(3, h - 2))
			_leaf(image, base, tip, 1.5 if key == "carpet_grass" else 2.5, greens[rng.randi_range(0, 3)])
	elif key in ["rotala", "ludwigia_red", "hygrophila", "hornwort"]:
		for stem in range(5):
			var base := Vector2(8 + stem * 4, h)
			var top := Vector2(base.x + rng.randf_range(-5, 5), rng.randf_range(3, 28))
			_line(image, base, top, greens[0])
			for row in range(10):
				var p := base.lerp(top, float(row) / 10)
				for side in [-1, 1]:
					_leaf(image, p, p + Vector2(side * rng.randf_range(5, 10), -5), 2.4, greens[mini(3, int(row / 4.0) + 1)])
	elif key == "vallisneria":
		for blade in range(9):
			var base := Vector2(w / 2 + rng.randf_range(-5, 5), h)
			var tip := Vector2(rng.randf_range(3, w - 3), rng.randf_range(2, 35))
			_leaf(image, base, tip, 2.6, greens[blade % 3])
	else:
		var count := 9 if key == "java_fern" else 7
		for index in range(count):
			var base := Vector2(w * 0.5 + rng.randf_range(-4, 4), h - 1)
			var tip := Vector2(3 + float(index) / (count - 1) * (w - 6), rng.randf_range(3, h * 0.43))
			var root := base.lerp(tip, 0.25)
			_line(image, base, tip, greens[0])
			_leaf(image, root, tip, 3.3 if key == "java_fern" else 6.0, greens[index % 3])


static func _rock(image: Image, rng: RandomNumberGenerator) -> void:
	var w := float(image.get_width())
	var h := float(image.get_height())
	var outline := PackedVector2Array([Vector2(1, h), Vector2(w * 0.08, h * 0.70),
		Vector2(w * 0.21, h * 0.57), Vector2(w * 0.30, h * 0.19), Vector2(w * 0.52, 2),
		Vector2(w * 0.70, h * 0.13), Vector2(w * 0.86, h * 0.54), Vector2(w - 1, h - 2)])
	_polygon(image, outline, Color("4F5B55"))
	_polygon(image, PackedVector2Array([Vector2(3, h - 2), Vector2(w * 0.32, h * 0.22),
		Vector2(w * 0.53, 3), Vector2(w * 0.66, h * 0.44), Vector2(w * 0.44, h - 2)]), Color("9AA59B"))
	_polygon(image, PackedVector2Array([Vector2(w * 0.54, 4), Vector2(w * 0.70, h * 0.16),
		Vector2(w - 3, h - 3), Vector2(w * 0.46, h - 1), Vector2(w * 0.68, h * 0.48)]), Color("6E7D74"))
	for y in range(4, image.get_height() - 2):
		for x in range(2, image.get_width() - 2):
			if image.get_pixel(x, y).a == 0:
				continue
			var seam := posmod(y + floori(x * 0.48), 14)
			if seam == 0 and rng.randf() < 0.65:
				image.set_pixel(x, y, Color("C3CBC1"))
			elif rng.randf() < 0.035:
				image.set_pixel(x, y, Color("4F5B55"))


static func _wood(image: Image) -> void:
	var branches := [PackedVector2Array([Vector2(33, 96), Vector2(48, 69), Vector2(76, 54), Vector2(111, 31)]),
		PackedVector2Array([Vector2(48, 76), Vector2(37, 43), Vector2(17, 21), Vector2(12, 6)]),
		PackedVector2Array([Vector2(66, 62), Vector2(70, 35), Vector2(88, 10)])]
	for branch: PackedVector2Array in branches:
		for index in range(branch.size() - 1):
			var width := 10 - index * 3
			_line(image, branch[index], branch[index + 1], Color("4A3A2E"), width)
			_line(image, branch[index] - Vector2(1, 1), branch[index + 1] - Vector2(1, 1), Color("8B6B4E"), maxi(1, width - 3))
			_line(image, branch[index] - Vector2(2, 1), branch[index + 1] - Vector2(2, 1), Color("B08E6E"))
