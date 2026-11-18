shader_type canvas_item;
render_mode unshaded, blend_add;

uniform vec4 light_color : source_color = vec4(0.839216, 0.941176, 0.909804, 1.0);
uniform float intensity : hint_range(0.0, 0.2) = 0.035;
varying vec2 world_pixel;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float cells(vec2 p) {
	vec2 cell = floor(p);
	vec2 f = fract(p);
	float nearest = 8.0;
	float second = 8.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 n = vec2(float(x), float(y));
			float h = hash(cell + n);
			vec2 point = 0.5 + 0.34 * sin(vec2(h * 6.28, h * 9.13) + TIME * 0.27);
			float d = length(n + point - f);
			second = max(nearest, min(second, d));
			nearest = min(nearest, d);
		}
	}
	return 1.0 - smoothstep(0.015, 0.18, second - nearest);
}

void vertex() { world_pixel = VERTEX; }
void fragment() {
	// Local world coordinates retain a 1px grid when the camera pans or the window scales.
	vec2 p = floor(world_pixel);
	float a = cells(p / 29.0 + vec2(TIME * 0.035, TIME * 0.024));
	float b = cells(p / 43.0 + vec2(-TIME * 0.026, TIME * 0.018));
	float bands = floor(clamp(a * 0.7 + b * 0.3, 0.0, 0.999) * 3.0) / 2.0;
	COLOR = vec4(light_color.rgb, bands * intensity);
}
