shader_type canvas_item;
render_mode unshaded;

uniform float strength : hint_range(0.0, 2.0) = 2.0;
uniform float current : hint_range(-1.0, 1.0) = 0.0;
uniform float phase = 0.0;
uniform bool highlighted = false;
varying vec4 sprite_tint;

void vertex() { sprite_tint = COLOR; }

void fragment() {
	vec2 pixel_uv = (floor(UV / TEXTURE_PIXEL_SIZE) + 0.5) * TEXTURE_PIXEL_SIZE;
	float height = 1.0 - pixel_uv.y;
	float wave = sin(TIME * 1.1 + phase + height * 1.6);
	float offset_px = round(clamp((wave + current) * strength * height * height, -2.0, 2.0));
	pixel_uv.x -= offset_px * TEXTURE_PIXEL_SIZE.x;
	COLOR = texture(TEXTURE, pixel_uv) * sprite_tint;
	if (pixel_uv.x < 0.0 || pixel_uv.x > 1.0) { COLOR.a = 0.0; }
	if (highlighted && COLOR.a < 0.5) {
		float edge = 0.0;
		for (int i = 0; i < 4; i++) {
			vec2 direction = vec2(i == 0 ? -1.0 : (i == 1 ? 1.0 : 0.0), i == 2 ? -1.0 : (i == 3 ? 1.0 : 0.0));
			vec2 neighbor = pixel_uv + direction * TEXTURE_PIXEL_SIZE;
			if (all(greaterThanEqual(neighbor, vec2(0.0))) && all(lessThanEqual(neighbor, vec2(1.0)))) {
				edge = max(edge, texture(TEXTURE, neighbor).a);
			}
		}
		if (edge > 0.5) { COLOR = vec4(0.94902, 0.717647, 0.494118, 1.0); }
	}
}
